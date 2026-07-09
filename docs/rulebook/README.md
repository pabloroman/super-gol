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
  scans/             original photos (source of truth)
    page-01.jpeg     page 1 (single page)
    pages-02-03.jpeg  page spreads photographed two-up
    pages-04-05.jpeg
    pages-06-07.jpeg
    pages-08-09.jpeg
    pages-10-11.jpeg
  pages/             faithful Spanish transcription, one file per page
    page-01.md ... page-11.md
```

The camera captured the booklet as two-page spreads, so most scans hold two
pages; each `pages/page-NN.md` notes which half of which scan it transcribes.

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
| 1 | [scan](scans/page-01.jpeg) | [text](pages/page-01.md) | Intro (*Super Gol*), **El campo** — pitch: 6×5 grid + zones RM/DL/PA |
| 2 | [scan](scans/pages-02-03.jpeg) | [text](pages/page-02.md) | **La carta** — card anatomy; character list (Básicas / Avanzadas) |
| 3 | [scan](scans/pages-02-03.jpeg) | [text](pages/page-03.md) | Remaining characters; goalkeeper stats; **Juego básico**: turno, jugada, movimientos |
| 4 | [scan](scans/pages-04-05.jpeg) | [text](pages/page-04.md) | Movements (normal, relevos); **Marcajes**; initial placement |
| 5 | [scan](scans/pages-04-05.jpeg) | [text](pages/page-05.md) | **Forma de jugar** — attacker & defender options |
| 6 | [scan](scans/pages-06-07.jpeg) | [text](pages/page-06.md) | **Características básicas**; **Pases**: directo, corto |
| 7 | [scan](scans/pages-06-07.jpeg) | [text](pages/page-07.md) | Pase largo; pase corto al hueco |
| 8 | [scan](scans/pages-08-09.jpeg) | [text](pages/page-08.md) | Pase largo al hueco; **Interrupciones**: anticipación |
| 9 | [scan](scans/pages-08-09.jpeg) | [text](pages/page-09.md) | Robo de balón; **Regates**: regate |
| 10 | [scan](scans/pages-10-11.jpeg) | [text](pages/page-10.md) | **Remates**: remate en el área; disparo lejano |
| 11 | [scan](scans/pages-10-11.jpeg) | [text](pages/page-11.md) | **Portero** (RF, CO, saques, cesiones); modalidad de juego básico |

_Pages 1–11 (the **Juego Básico**) are transcribed. The **Juego Avanzado** and
the worked example match referenced in the intro have not been photographed yet._

## The dice mechanic at a glance

Every contested action rolls to reach **≥ 10** from a sum. Rule of thumb:

- **Unmarked / zonal mark:** one die + 5 + the relevant ability → `d6 + 5 + X ≥ 10`
- **Man-marked (hombre):** two dice + the ability → `d6 + d6 + X ≥ 10`

`X` is the acting player's ability for that action (PC, PL, RG, A, RB, RM, DL…).
The goalkeeper saves on `d6 + d6 + RF` (from RM) or `d6 + d6 + CO` (from DL),
stopping the shot on a total of 10, 11 or 12. This is the core of the real
`play_match` engine that will replace the current placeholder.
