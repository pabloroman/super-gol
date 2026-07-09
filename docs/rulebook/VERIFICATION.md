# Rulebook — verification worklist

The transcription in `pages/` is complete, but some spots were photographed at a
distance / hand-underlined / very small, so they were transcribed **best-effort
and flagged**. This file collects every flagged item in one place, in **priority
order**, with the current reading laid out so a human review only has to
**confirm or correct** each one — not re-transcribe.

**How to use this**
- Go through each item against the scan (`scans/…`) or the physical booklet.
- If correct, tick it. If wrong, note the fix (edit the file directly, or just
  tell me the corrections and I'll apply them and re-push).
- Priority 1 (the tables) is the only thing that materially blocks the game
  engine; everything else is polish.

Legend used by the tables (from page 31): **MH** = marcaje al hombre · **MZ** =
marcaje en zona · **SM** = sin marcaje · **Nº** = number of dice to roll. Cell
contents are the defender/keeper responses: **RB** robo de balón · **F** falta ·
**PEN** penalty · **A** anticipación · **RC** remate/despeje de cabeza · **CO**
colocación · **RF** reflejos · **SA** salida por alto · **SP** salida a los pies.
Notes: shaded cells need the defender to *be able to move*; **(\*)** = "SP and/or
penalty, and no need to be able to move".

---

## ★ Priority 1 — TABLA 1 & TABLA 2 (page 30)

**Update:** sharp macro close-ups now exist
(`scans/tabla-1-closeup.png`, `scans/tabla-2-closeup.png`), so the reading is
now high-confidence. The full transcription lives in
[`pages/page-30.md`](pages/page-30.md). **TABLA 1 is considered verified** (it is
even self-consistent with the page-31 worked example: PC passer-SM Nº = 0 +
receiver-MH Nº = 2 → "máximo entre 0 y 2 = 2" ✓).

**The only thing still open is TABLA 2's stacked cells.** For the shots
(RM / DL / RC), each marking cell appears to hold **two** responses — the
outfield defender's (`RB y/o F`) and the goalkeeper's (`SP y/o PEN` before the
shot; `RF` / `CO` after). Please confirm against `scans/tabla-2-closeup.png`:

1. In each **RM/DL/RC** cell, do both the defender option and the keeper option
   really coexist, as in page-30.md?
2. Is the **Antes / Después** split right — keeper `SP y/o PEN` *before* the
   shot, and `RF` (RM/RC) or `CO` (DL) *after*?
3. **RC** row: is the "Antes" really just `SA`, with no `RB y/o F`?

Everything else in both tables (headers, rows, all `Nº` counts, and all of
TABLA 1) reads cleanly from the close-ups.

---

## Priority 2 — Worked-example dice values (pages 14–16)

The play-by-play is legible; the small `(D1: x + D2: y + z)` roll values are not
always. Please confirm each roll. Notation: `!` = conseguido, `?` = fallado.

**Page 14 (turns 1–3)** — the only roll is:
- Play 18 — Vizcaíno **RB !** (D1: 5 + D2: 6 + 0)
- Play 20 — Solozábal→Francisco **PL ?** (5 + D1: 2 + 1)

**Page 15 (turns 4–7)**
- 27 — Barbará **RG !** (D1: 4 + D2: 4 + 2)
- 29/30 — order + values uncertain. Current reading:
  Solozábal **RB ?** (D1: 3 + D2: 3 + 2), then Barbará **DL !** (D1: 5 + D2: 5 + 0).
  **Q:** does the RB come *before* the shot, and is the shot `5 + D1:5 + 0`
  (1 die, because Barbará became free/zonal) or two dice?
- 33 — Bakero **PC Hueco !** (D1: 6 + D2: 4 + 0)
- 36 — Vizcaíno→Francisco **PL !** (D1: 4 + D2: 5 + 1); Tocornal **A !** (D1: 4 + D2: 4 + 2)
- 37 — Tocornal→Barbará **PL !** (5 + D1: 6 + 0); Solozábal **A ?** (D1: 1 + D2: 2 + 2)
- 38 — Barbará **DL !** (D1: 5 + D2: 6 + 0); Ablanedo **CO !** (D1: 5 + D2: 4 + 3)
- 39 — Ablanedo **PL Hueco ?** (D1: 1 + D2: 5 + 0)

**Page 16 (turn 8 → goal)**
- Kiko **RB ?** (D1: 4 + D2: 5 + 0)
- 43 — Michel **DL ?** (5 + D2: 2 + 2)
- 50 — Francisco→Kiko **PC !** (5 + D1: 2 + 3); Tocornal **A ?** (D1: 6 + D2: 1 + 2)
- 52 — Camarasa **RB ?** (D1: 2 + D2: 2 + 3)
- 53 — Kiko **RM !** (5 + D1: 4 + 2); Zubizarreta **RF ?** (D1: 4 + D2: 3 + 2) → ¡GOL!

**Page 25 (advanced example)**
- 1 — Escaich **D ?** (D1: 3 + D2: 1 + 0); Felipe→Escaich **PA !** (D1: 4 + D2: 5 + 2);
  Zubizarreta **SA ?** (D1: 2 + D2: 3 + 2); Karanka **RC ?** (D1: 3 + D2: 4 + 2)
- 2 — Escaich **RC !** (5 + D1: 4 + 2)

**Page 26 (advanced example)**
- 1 — Francisco **D ?** (D1: 4 + D2: 5 + 0); Morales→Francisco **PL !** (D1: 6 + D2: 4 + 0);
  Camarasa **A ?** (D1: 1 + D2: 6 + 2); Ablanedo **SP ?** (D1: 2 + D2: 4 + 3)
- 2 — Francisco **RM !** (5 + D1: 5 + 0) → ¡GOOOOL!

---

## Priority 3 — Board diagrams (Figuras 1–9, pages 17, 25, 26)

These were described by *role* (which turn each illustrates) rather than mapped
cell-by-cell, because piece positions weren't reliably readable. If you're
willing, the useful thing per figure is the **grid coordinate of each numbered
player** (columns 1–6 × rows A–E), and which cell holds the ball (**X**). Only
worth doing if you want the example match fully reconstructable in code.

---

## Priority 4 — Heavily underlined / reconstructed paragraphs

Prose that was hand-underlined or awkwardly split; meaning is clear but exact
wording should be checked:

- **Page 23** — "Libres directos desde fuera del área": the barrera vs.
  no-barrera dice rule. Current reading: **with** barrera → `D1 + D2 + LF`;
  **no** barrera (defender negligence) → `D1 + 5 + LF`. Confirm which is which.
- **Page 23** — "Penalty": confirm keeper stops on a **6** (single die), no RF.
- **Page 29** — "Reglamento oficial del torneo": confirm the bullet list,
  especially **100-point** cap, **demarcación** (abilities only in zone except
  LF/RM/DL/RC), **3 foreigners**, 15-turn time limit.

---

## Confirmed OK (no action needed)

- Page numbering — cross-checked against the **índice** (pages 32–33). ✓
- All Juego Básico prose (pages 1–13) and Juego Avanzado prose (pages 18–22,
  24, 27–28) read cleanly.
