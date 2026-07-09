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
    pages-12-13.jpeg
    pages-14-15.jpeg
    pages-16-17.jpeg
    pages-18-19.jpeg
    pages-20-21.jpeg
  pages/             faithful Spanish transcription, one file per page
    page-01.md ... page-21.md
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
- Game-term abbreviations from the rulebook are kept as-is:
  - **Pitch zones:** RM (remate cercano), DL (disparo lejano), PA (pases altos)
  - **Outfield abilities:** PC, PL, RG, A, RB (básicas); V, PA, F, D, RC, LF, RM,
    DL (avanzadas)
  - **Goalkeeper:** CO (colocación), RF (reflejos), SA (salida por alto),
    SP (salida a los pies)

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
| 12 | [scan](scans/pages-12-13.jpeg) | [text](pages/page-12.md) | Basic-mode limits; **¡MUY importante!** (turn/movement restrictions) |
| 13 | [scan](scans/pages-12-13.jpeg) | [text](pages/page-13.md) | **¡Y finalmente el partido!** — line-ups; nomenclatura; graphic legend |
| 14 | [scan](scans/pages-14-15.jpeg) | [text](pages/page-14.md) | Worked example match — turns 1–3 (plays 1–23) |
| 15 | [scan](scans/pages-14-15.jpeg) | [text](pages/page-15.md) | Worked example match — turns 4–7 (plays 24–41) |
| 16 | [scan](scans/pages-16-17.jpeg) | [text](pages/page-16.md) | Worked example match — turn 8 to the goal (plays 42–53) |
| 17 | [scan](scans/pages-16-17.jpeg) | [text](pages/page-17.md) | Board diagrams **Figura 1–5** (described; positions in scan) |
| 18 | [scan](scans/pages-18-19.jpeg) | [text](pages/page-18.md) | **Juego avanzado**; características avanzadas: desmarque, velocidad |
| 19 | [scan](scans/pages-18-19.jpeg) | [text](pages/page-19.md) | Velocidad (cont.); **pase alto** |
| 20 | [scan](scans/pages-20-21.jpeg) | [text](pages/page-20.md) | Remate de cabeza; anticipación a un remate de cabeza |
| 21 | [scan](scans/pages-20-21.jpeg) | [text](pages/page-21.md) | Anticipación (cont.); **Faltas** (start of the foul table) |

_Pages 1–21 are transcribed: the full **Juego Básico** (1–13), the worked
example match with its diagrams (14–17), and the start of the **Juego Avanzado**
(18–21). The advanced section continues past page 21 — the **Faltas** result
table breaks off mid-list, so at least page 22 onward is not yet photographed._

## The dice mechanic at a glance

Every contested action rolls to reach **≥ 10** from a sum. Rule of thumb:

- **Unmarked / zonal mark:** one die + 5 + the relevant ability → `d6 + 5 + X ≥ 10`
- **Man-marked (hombre):** two dice + the ability → `d6 + d6 + X ≥ 10`

`X` is the acting player's ability for that action (PC, PL, RG, A, RB, RM, DL…).
The goalkeeper saves on `d6 + d6 + RF` (from RM) or `d6 + d6 + CO` (from DL),
stopping the shot on a total of 10, 11 or 12. This is the core of the real
`play_match` engine that will replace the current placeholder.
