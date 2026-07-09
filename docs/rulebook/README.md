# Super Gol — Rulebook (original reference)

This folder is the **canonical transcription of the original Super Gol
rulebook**, the paper instructions that shipped with the card game
(*Naipes Heraclio Fournier, S.A. — Vitoria, Depósito Legal VI. 495 · 1995 ·
Printed in Spain*).

It exists so the digital recreation in this repo can implement the **real**
rules (the `d6 + ability + pitch-zone` simulation) faithfully, rather than the
placeholder match engine currently in `play_match`. When a rule is ambiguous in
code, this transcription — and the original scans it is based on — are the
source of truth.

## Layout

```
docs/rulebook/
  README.md          this index
  scans/             original photos of each page (source of truth)
    page-01.jpeg
    ...
  pages/             faithful Spanish transcription, one file per page
    page-01.md
    ...
```

## Conventions

- **`scans/`** holds the raw photographs, exactly as provided. Never edit these.
- **`pages/`** holds a faithful transcription of the Spanish text of each page,
  preserving the original wording, headings, and terminology. Diagrams are
  described in text and, where useful, redrawn as ASCII / Markdown tables.
- Transcriptions aim to be **literal** (typos and all), so that any later
  English translation or rules interpretation can be traced back to the source.
- Game-term abbreviations from the rulebook (RM, DL, PA, and the ability codes
  RB, A, RC, D, RG, V, PC, PL, PA, DL) are kept as-is.

## Pages

| Page | Scan | Transcription | Contents |
|------|------|---------------|----------|
| 1 | [scan](scans/page-01.jpeg) | [text](pages/page-01.md) | Intro (*Super Gol*), **El campo** (the pitch: 6×5 grid + special zones RM/DL/PA) |

_More pages to be added as they are photographed and transcribed._
