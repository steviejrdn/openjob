# OpenJob installer (Windows PowerShell)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -Command "curl.exe -fsSL https://raw.githubusercontent.com/steviejrdn/openjob/main/scripts/install.ps1 -o $env:TEMP\install-openjob.ps1; & $env:TEMP\install-openjob.ps1"
#
# Env overrides: OPENJOB_VERSION, OPENJOB_INSTALL_DIR, OPENJOB_REPO,
# OPENJOB_RUNTIME_DIR, OPENJOB_HOST_DIR, OPENJOB_BASE_URL

param(
  [string]$Version = $env:OPENJOB_VERSION,
  [string]$InstallDir = $env:OPENJOB_INSTALL_DIR,
  [string]$Repo = $(if ($env:OPENJOB_REPO) { $env:OPENJOB_REPO } else { "steviejrdn/openjob" }),
  [string]$RuntimeDir = $env:OPENJOB_RUNTIME_DIR,
  [Alias("WorkspaceDir")]
  [string]$HostDir = $(if ($env:OPENJOB_HOST_DIR) { $env:OPENJOB_HOST_DIR } else { $env:OPENJOB_WORKSPACE_DIR })
)

$ErrorActionPreference = "Stop"

if (-not $Version) { $Version = "latest" }
if (-not $InstallDir) { $InstallDir = Join-Path $env:USERPROFILE ".local\bin" }
if (-not $RuntimeDir) { $RuntimeDir = Join-Path $env:USERPROFILE ".local\share\openjob" }
if (-not $HostDir) { $HostDir = Join-Path $env:USERPROFILE "OpenJob" }

$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { $arch = "arm64" }
if ($arch -eq "x86") {
  Write-Error "install: unsupported architecture: x86"
  exit 1
}

$baseline = ""
if ($arch -eq "x64") {
  $avx2 = $false
  try {
    $out = & powershell.exe -NoProfile -NonInteractive -Command '(Add-Type -MemberDefinition "[DllImport(\"kernel32.dll\")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);" -Name Kernel32 -Namespace Win32 -PassThru)::IsProcessorFeaturePresent(40)'
    $avx2 = ($out -eq "1" -or $out -match "True")
  } catch { $avx2 = $false }
  if (-not $avx2) { $baseline = "-baseline" }
}

$asset = "openjob-windows-$arch$baseline.zip"
if ($env:OPENJOB_BASE_URL) {
  $base = $env:OPENJOB_BASE_URL
} elseif ($Version -eq "latest") {
  $base = "https://github.com/$Repo/releases/latest/download"
} else {
  $base = "https://github.com/$Repo/releases/download/v$Version"
}

$tmp = Join-Path $env:TEMP ("openjob-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null

try {
  Write-Host "OpenJob installer"
  Write-Host "  Asset: $asset  Version: $Version"
  Write-Host "  Downloading $base/$asset"

  $zip = Join-Path $tmp $asset
  curl.exe -fsSL "$base/$asset" -o $zip

  $extract = Join-Path $tmp "extract"
  Expand-Archive -Path $zip -DestinationPath $extract -Force

  $bin = Get-ChildItem -Path $extract -Filter "openjob*.exe" -File | Select-Object -First 1
  if (-not $bin) { Write-Error "install: openjob.exe not found in archive"; exit 1 }

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Copy-Item $bin.FullName (Join-Path $InstallDir "openjob.exe") -Force
  Write-Host "  Installed $(Join-Path $InstallDir 'openjob.exe')"

  if ($env:PATH -notlike "*$InstallDir*") {
    Write-Host "  NOTE: $InstallDir is not on your PATH."
    Write-Host "        Add it with: setx PATH `"$InstallDir;`$env:PATH`""
  }

  New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
  $wsZip = Join-Path $tmp "openjob-workspace.tar.gz"
  try {
    curl.exe -fsSL "$base/openjob-workspace.tar.gz" -o $wsZip
    $wsExtract = Join-Path $tmp "workspace"
    New-Item -ItemType Directory -Path $wsExtract -Force | Out-Null
    tar -xzf $wsZip -C $wsExtract
    $legacy = Join-Path $RuntimeDir "workspace"
    if ((-not (Test-Path $HostDir)) -and (Test-Path (Join-Path $legacy "users"))) {
      Move-Item $legacy $HostDir
      Write-Host "  Moved existing workspace to $HostDir (users preserved)"
    } elseif ((-not (Test-Path $HostDir)) -and (Test-Path $legacy)) {
      Remove-Item $legacy -Recurse -Force
    }
    if ((Test-Path $HostDir) -and (-not (Test-Path (Join-Path $HostDir "scaffold"))) -and (-not (Test-Path (Join-Path $HostDir ".openjob"))) -and (-not (Test-Path (Join-Path $HostDir "users"))) -and ((Get-ChildItem $HostDir -Force | Measure-Object).Count -gt 0)) {
      Write-Host "  WARNING: $HostDir exists and is not an OpenJob workspace; using $legacy instead"
      $HostDir = $legacy
    }
    New-Item -ItemType Directory -Path $HostDir -Force | Out-Null
    # Refresh only host-owned entries and never touch users/: each users/<name>/
    # directory holds a person's profile, CVs, documents and application history.
    foreach ($entry in @(".agents", "tools", "fonts", "scaffold", "openjob.json", "SECURITY.md")) {
      $path = Join-Path $HostDir $entry
      if (Test-Path $path) { Remove-Item $path -Recurse -Force }
    }
    Copy-Item (Join-Path $wsExtract "*") $HostDir -Recurse -Force
    Set-Content -Path (Join-Path $RuntimeDir "host") -Value $HostDir
    Write-Host "  Workspace installed to $HostDir (existing users preserved)"

  } catch {
    Write-Host "  WARNING: could not install workspace template: $_"
  }

  Write-Host "  OpenJob installed successfully."
  Write-Host "  Run: openjob"
  Write-Host "  Workspace: $HostDir"
  Write-Host "  Documents: $HostDir\users\<name>\documents"
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
