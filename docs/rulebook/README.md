# Super Gol — Rulebook (original reference)

This folder is the **canonical transcription of the original Super Gol
rulebook**, the paper instructions that shipped with the card game
(*Naipes Heraclio Fournier, S.A. — Vitoria, Depósito Legal VI. 495 · 1995 ·
Printed in Spain*).

It exists so the digital recreation in this repo can implement the **real**
rules faithfully. The turn-based **Juego Básico** engine in `src/game/board/` is
built against this transcription; when a rule is ambiguous in code, this
transcription — and the original scans it is based on — are the source of truth.
The deliberate departures from the paper rules (chiefly the 15-turno clock) are
recorded in [`DEVIATIONS.md`](./DEVIATIONS.md).

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
    pages-22-23.jpeg
    pages-24-25.jpeg
    pages-26-27.jpeg
    pages-28-29.jpeg
    pages-30-31.jpeg
    pages-30-31-alt.jpeg  second photo of the tables page (same resolution)
    pages-32-33.jpeg      índice (table of contents)
  pages/             faithful Spanish transcription, one file per page
    page-01.md ... page-33.md
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
| 1 | [scan](scans/page-01.jpeg) | [text](pages/page-01.md) | Intro (*Super Gol*), **El campo** — pitch: 5 cols × 6 rows, a goal at each end + zones RM/DL/PA |
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
| 22 | [scan](scans/pages-22-23.jpeg) | [text](pages/page-22.md) | Foul result table (cards); **¿Cómo se saca la falta?** |
| 23 | [scan](scans/pages-22-23.jpeg) | [text](pages/page-23.md) | Libres directos (LF); **Penalty**; advanced goalkeeper |
| 24 | [scan](scans/pages-24-25.jpeg) | [text](pages/page-24.md) | **Salida a los pies (SP)**; **salida por alto (SA)**; relevo con portero |
| 25 | [scan](scans/pages-24-25.jpeg) | [text](pages/page-25.md) | Relevo-portero result; example **Figura 6–7** |
| 26 | [scan](scans/pages-26-27.jpeg) | [text](pages/page-26.md) | Example **Figura 8–9** (goal) |
| 27 | [scan](scans/pages-26-27.jpeg) | [text](pages/page-27.md) | **Reglas avanzadas**: fuera de juego, córner, fuera de banda |
| 28 | [scan](scans/pages-28-29.jpeg) | [text](pages/page-28.md) | Movimiento propio del balón; fuera de gol; cambios; lesiones |
| 29 | [scan](scans/pages-28-29.jpeg) | [text](pages/page-29.md) | **Reglamento oficial del torneo** (100 pts, demarcación); curiosidades |
| 30 | [scan](scans/pages-30-31.jpeg) | [text](pages/page-30.md) | **TABLA 1 & TABLA 2** — master reference tables (verify vs scan) |
| 31 | [scan](scans/pages-30-31.jpeg) | [text](pages/page-31.md) | **Cómo leer las tablas**; worked table examples |
| 32 | [scan](scans/pages-32-33.jpeg) | [text](pages/page-32.md) | **Índice** (1/2) — confirms page numbers |
| 33 | [scan](scans/pages-32-33.jpeg) | [text](pages/page-33.md) | **Índice** (2/2) |

_**The full booklet (all 33 pages) is now transcribed.**_ It covers the complete
**Juego Básico** (1–13) with a worked example match (14–17), the complete **Juego
Avanzado** (18–29) — advanced abilities, fouls, penalties, offside, corners,
substitutions, injuries and the **official tournament regulation** — and the two
master reference tables (30–31).

### Verification status

**Everything the engine relies on is verified against the physical booklet** —
all prose, TABLA 1 & 2 (from the macro close-ups `tabla-1-closeup.png` /
`tabla-2-closeup.png`), the worked example's dice values roll by roll, and the
board figures of pages 1 and 17. The índice (p32–33) cross-checks every page
number in the table above.

The one thing left is **Figuras 6–9** (pages 25–26), the board diagrams of the
two Juego Avanzado examples — low priority, since the engine implements the basic
game only. It is tracked in **[`VERIFICATION.md`](VERIFICATION.md)**, which holds
open items only; each is deleted as it settles.

### The booklet's own errata

Three spots where the original contradicts itself. All are transcribed **as
printed**, with a note where they appear:

- **Pages 15–16** — the chronicle swaps the two goalkeepers' names: read
  "Ablanedo" as **Zubizarreta** and vice versa. The page-13 lineup is the correct
  one, and pages 25–26 agree with it.
- **Figura 3 (p17)** — draws E2/E3 without the relevo of play 4, and Larrazabal
  on A5 instead of B5. For those pieces it shows a board state earlier than the
  one it is captioned for.
- **Figura 5 (p17)** — omits the white goalkeeper; the goal has posts but no `1`.

Figuras 1, 2 and 4 are the trustworthy snapshots; where a figure and the
chronicle disagree, the chronicle wins.

## The dice mechanic at a glance

Every contested action rolls to reach **≥ 10** from a sum. Rule of thumb:

- **Unmarked / zonal mark:** one die + 5 + the relevant ability → `d6 + 5 + X ≥ 10`
- **Man-marked (hombre):** two dice + the ability → `d6 + d6 + X ≥ 10`

`X` is the acting player's ability for that action (PC, PL, RG, A, RB, RM, DL…).
The goalkeeper saves on `d6 + d6 + RF` (from RM) or `d6 + d6 + CO` (from DL),
stopping the shot on a total of 10, 11 or 12. This is the core of the real
`play_match` engine that will replace the current placeholder. **TABLA 1 & 2**
(pages 30–31) are the complete lookup for "how many dice + which defensive
responses" per action and marking type — the definitive spec for the engine,
pending a sharper re-shoot.

### Rules that confirm the app's design

The **Reglamento oficial del torneo** (page 29) independently confirms two
constraints already baked into the codebase:

- **Point-limited squads** — "un máximo de **100 puntos** (suma de las fichas de
  los 16 jugadores)". The app enforces a cap in `save_squad`, but scaled to its
  11-player squad: **70 points** (100 × 11/16 ≈ 70). See `DEVIATIONS.md`.
- **Demarcación** — a card's abilities only apply in its pitch zone (except
  LF/RM/DL/RC), matching the per-card pitch-zone grid.
- **No foreign-player limit.** The tournament's *3-extranjeros-per-team* cap
  (page 29) is deliberately not implemented; Super Gol imposes no cap on foreign
  players, matching the basic game (page 12). **3 substitutions** remain noted
  for later features.
