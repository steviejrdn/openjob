% Intro Options
\ProvidesClass{cover}[2024/04/30 Cover letter class]
\NeedsTeXFormat{LaTeX2e}
\DeclareOption{print}{\def\@cv@print{}}
\DeclareOption*{%
  \PassOptionsToClass{\CurrentOption}{article}
}
\ProcessOptions\relax
\LoadClass{article}

% Package Imports
\usepackage[hmargin=2.3cm, vmargin=2.3cm]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage[usenames,dvipsnames]{xcolor}
\usepackage{titlesec}
\usepackage[absolute]{textpos}
\usepackage{fontspec,xltxtra,xunicode}

% Publications
\usepackage{cite}
\renewcommand\refname{\vskip -1.5cm}

% Color definitions
\definecolor{date}{HTML}{666666}
\definecolor{primary}{HTML}{2b2b2b}
\definecolor{headings}{HTML}{6A6A6A}
\definecolor{subheadings}{HTML}{333333}

% Set main fonts
% Google Sans lives in the repo's /fonts directory (../fonts relative to
% cover_letters/). It is a proprietary font kept for personal use only and
% must never be committed to git (see .gitignore).
\setmainfont[Color=primary, Ligatures=TeX, Path = ../fonts/,
  BoldItalicFont=GoogleSans-BoldItalic,
  BoldFont=GoogleSans-Bold,
  ItalicFont=GoogleSans-Italic]{GoogleSans-Regular}
\setsansfont[Scale=MatchLowercase,Ligatures=TeX, Path = ../fonts/,
  BoldFont=GoogleSans-Bold,
  ItalicFont=GoogleSans-Italic]{GoogleSans-Regular}

% Named Google Sans families used across the letter body and headings
\newfontfamily\gsregular[Ligatures=TeX, Path = ../fonts/,
  BoldItalicFont=GoogleSans-BoldItalic,
  BoldFont=GoogleSans-Bold,
  ItalicFont=GoogleSans-Italic]{GoogleSans-Regular}
\newfontfamily\gsmedium[Ligatures=TeX, Path = ../fonts/,
  BoldItalicFont=GoogleSans-BoldItalic,
  BoldFont=GoogleSans-Bold,
  ItalicFont=GoogleSans-Italic]{GoogleSans-Medium}
\newfontfamily\gsbold[Ligatures=TeX, Path = ../fonts/]{GoogleSans-Bold}

% Date command
\setlength{\TPHorizModule}{1mm}
\setlength{\TPVertModule}{1mm}
\newcommand{\lastupdated}{\begin{textblock}{60}(155,5)
\color{date}\gsregular\fontsize{8pt}{10pt}\selectfont
Last Updated on \today
\end{textblock}}

% Name command
\newcommand{\namesection}[3]{
\centering{
\fontsize{40pt}{60pt}
\gsmedium\selectfont #1
\gsmedium\selectfont #2
} \\[5pt]
\centering{
\color{headings}
\gsregular\fontsize{11pt}{14pt}\selectfont #3}
\noindent\makebox[\linewidth]{\color{headings}\rule{\paperwidth}{0.0pt}}
\vspace{0pt}
}

% Section seperators
\titlespacing{\section}{0pt}{0pt}{0pt}
\titlespacing{\subsection}{0pt}{0pt}{0pt}
\newcommand{\sectionsep}{\vspace{8pt}}

% Headings command
\titleformat{\section}{\color{headings}
\scshape\gsregular\fontsize{16pt}{24pt}\selectfont \raggedright\uppercase}{}{0em}{}

% Subeadings command
\titleformat{\subsection}{
\color{subheadings}\gsbold\fontsize{12pt}{12pt}\selectfont\bfseries\uppercase}{}{0em}{}

\newcommand{\runsubsection}[1]{
\color{subheadings}\gsbold\fontsize{12pt}{12pt}\selectfont\bfseries\uppercase {#1} \normalfont}

% Descriptors command
\newcommand{\descript}[1]{
\color{subheadings}\raggedright\scshape\gsmedium\fontsize{11pt}{13pt}\selectfont {#1 \\} \normalfont}

% Location command
\newcommand{\location}[1]{
\color{headings}\raggedright\gsmedium\fontsize{10pt}{12pt}\selectfont {#1\\} \normalfont}

% Bullet Lists with fewer gaps command
\newenvironment{tightemize}{
\vspace{-\topsep}\begin{itemize}\itemsep1pt \parskip0pt \parsep0pt}
{\end{itemize}\vspace{-\topsep}}

% Cover Letter
\newcommand{\companyname}[1]{\raggedright\gsbold\fontsize{12pt}{14pt}\selectfont {#1 \\} \normalfont}

\newcommand{\companyaddress}[1]{\raggedright\gsmedium\fontsize{11pt}{13pt}\selectfont {#1 \\}\mbox{}\\\mbox{}\\ \normalfont}

\newcommand{\currentdate}[1]{\raggedleft\gsmedium\fontsize{11pt}{13pt}\selectfont {#1 \\} \normalfont}

% Letter content command
\newcommand{\lettercontent}[1]{\raggedright\gsmedium\fontsize{11pt}{13pt}\selectfont {#1 \\}\mbox{}\\ \normalfont}

\newcommand{\closing}[1]{\raggedright\gsmedium\fontsize{11pt}{13pt}\selectfont {#1 \\}\mbox{}\\\mbox{}\\ \normalfont}

\newcommand{\signature}[1]{\raggedright\gsmedium\fontsize{11pt}{13pt}\selectfont {#1 \\} \normalfont}
