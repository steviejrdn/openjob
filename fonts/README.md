# Shared fonts

OpenJob's system font directory. Every user workspace links to this directory
(`users/<name>/fonts -> ../../fonts`), so fonts are installed once, not copied
per user.

## Lato (default)

CVs and cover letters use **Lato** by default, from `fonts/lato/`:

| File | Weight |
|---|---|
| `Lato-Reg.ttf` / `Lato-RegIta.ttf` | Regular + Italic |
| `Lato-Bol.ttf` / `Lato-BolIta.ttf` | Bold + Bold Italic |
| `Lato-Lig.ttf` / `Lato-LigIta.ttf` | Light + Light Italic |
| `Lato-Hai.ttf` / `Lato-HaiIta.ttf` | Hairline + Hairline Italic |
| `Lato-Bla.ttf` / `Lato-BlaIta.ttf` | Black + Black Italic |

Lato is licensed under the SIL Open Font License 1.1 — see [OFL.txt](OFL.txt).
It may be redistributed with this repository.

## LaTeX usage

Templates reference these files with `Path=../fonts/lato/` (relative to `cv/` or
`cover_letters/`, where the compile command runs):

```latex
\setmainfont[Ligatures=TeX, Path=../fonts/lato/,
  BoldFont=Lato-Bol,
  ItalicFont=Lato-RegIta,
  BoldItalicFont=Lato-BolIta]{Lato-Reg}
```

Do not commit fonts anywhere else: `users/` is gitignored, and proprietary
fonts (e.g. Google Sans) are not part of this repository.
