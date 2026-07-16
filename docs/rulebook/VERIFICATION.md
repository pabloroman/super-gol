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

**TABLA 2 is now verified too** (confirmed by the booklet owner). For the shots
(RM / DL / RC), each marking cell holds **two** responses — the outfield
defender's (`RB y/o F`) and the goalkeeper's (`SP y/o PEN` before the shot;
`RF` / `CO` after). Confirmed:

1. ✓ In each RM/DL/RC cell the defender option and the keeper option coexist.
2. ✓ Antes = defender `RB y/o F` + keeper `SP y/o PEN`; Después = keeper `RF`
   (RM/RC) or `CO` (DL).
3. ✓ RC "Antes" is just `SA` (keeper salida por alto), no `RB y/o F`.

**Both tables are fully verified.** See [`pages/page-30.md`](pages/page-30.md).

---

## ✓ Priority 1b — RESOLVED: the chronicle swaps the two keepers' names

**The page-13 lineup is correct as printed** (blanco 1: ABLANEDO · negro 1:
ZUBIZARRETA — confirmed against the scan and by the booklet owner). The **pages
14–16 chronicle is the errata**: it has the two keeper names the wrong way round
in all six mentions. Read "Ablanedo" there as **Zubizarreta**, and vice versa.
Noted on pages 15 and 16; both keep the printed text.

How it was settled — three sources against one:

- **Lineup (page 13)** — prints ABLANEDO on the white side.
- **Page 25** — Zubizarreta relieves **Larrazabal** (negro 3), so Zubizarreta is
  negro. A relevo is a same-team swap.
- **Page 26** — Ablanedo relieves **Camarasa** (blanco 5), so Ablanedo is blanco.
- **Pages 14–16** — plays Ablanedo as the negro keeper: he saves **Barbará**'s
  shots (blanco 10, plays 30/38), restarts by passing to **Jaime** (negro 2,
  plays 31/44), and in play 39 his failed pass is collected by **Bjelica**
  (blanco 7) exactly as the page-7 rule demands. In play 53 Zubizarreta concedes
  to **Kiko** (negro 9).

Taking the chronicle as correct would mean the lineup row *and* both pages 25–26
relevos are wrong — and those relevos would become cross-team, which the rules
forbid. Taking the lineup as correct means one systematic slip: the author swapped
the two names while writing the basic example. Nothing else breaks.

**The worked example is no longer blocked as an engine fixture.** A fixture takes
keeper names from the page-13 lineup and ignores the chronicle's; every other name
in the chronicle is fine. Note the page-17 figures can't corroborate either way —
they show both keepers as dorsal 1 but name nobody.

## Priority 2 — Worked-example dice values (pages 14–16)

The play-by-play is legible; the small `(D1: x + D2: y + z)` roll values are not
always. Please confirm each roll. Notation: `!` = conseguido, `?` = fallado.

**Page 14 (turns 1–3)** — the only roll is:
- Play 18 — Vizcaíno **RB !** (D1: 5 + D2: 6 + 0)
- Play 20 — Solozábal→Francisco **PL ?** (5 + D1: 2 + 1)
- Play 7 — ✓ **corrected.** It reads "Garitano va a casilla **B4** (M. H. a
  Escaich)"; the transcription had **B5** and had dropped the M.H. B5 put three
  players in one cell (two of them negro), breaking the page-3 rule of max 2 "y
  siempre de distintos equipos". Figura 2 independently shows Garitano on B4.

**Page 15 (turns 4–7)**
- 27 — Barbará **RG !** (D1: 4 + D2: 4 + 2)
- 29/30 — ✓ **resolved** against a macro crop of `scans/pages-14-15.jpeg`, and it
  answers both halves of the old question: the RB **does** come before the shot,
  and the shot **is** the 1-die form. The page reads, in order:
  Solozábal **RB ?** (D1: 3 + D2: 3 + 2) · "Barbará ELIGE NO MOVER A OTRA
  CASILLA." · 30 — Barbará **DL !** (**5 + D1: 5 + 0**) · Ablanedo **CO !**
  (D1: 6 + D2: 5 +3). The transcription previously had the shot as
  `D1: 5 + D2: 5 + 0` (2 dice); both sum to 10, so only the **form** was wrong —
  and the form is what encodes the 1-die-vs-2-dice rule, so it mattered. The
  *why* is the page-9 robo-de-balón rule: Solozábal's RB failed and Barbará chose
  not to move, which leaves "el poseedor del balón … libre de cualquier tipo de
  marcaje" — unmarked, hence one die.
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

**Figuras 1–5 (page 17) are now transcribed** cell by cell in
[`pages/page-17.md`](pages/page-17.md). Page 17 turned out to be printed **rotated
90°**, which is why the positions had looked unreadable — rotated upright and
zoomed, the scan is legible. The board is **5 columns A–E × 6 rows 1–6** (letters
are the *columns*; the old note here said "columns 1–6 × rows A–E", which was the
axes swapped — see the page for the four independent confirmations).

Figura 2 reproduces the chronicle exactly, play for play, which is what makes the
whole example reconstructable in code.

- ✓ **Figura 3 has two drawing errors in the booklet** (both confirmed by the
  booklet owner). For those pieces the figure draws a *board state earlier than
  the one it is captioned for*:
  - `3` on E2 and `11` on E3 — the placement *before* the Nacho/Felipe relevo of
    play 4, which Figuras 2 and 4 both apply.
  - Larrazabal `(3)` on A5, his starting square, with Escaich alone on B5 —
    play 9 moves him to B5 to mark Escaich, and Figuras 2 and 4 put him there.

  The transcription keeps both as printed.

- ✓ **Figura 5 omits the white goalkeeper** — also a drawing error, confirmed by
  the booklet owner: the goal has its posts but no `1`, leaving only 10 white
  pieces. He should be there; he never moves all match. Kept as printed.

- ✓ **The upper/lower half of a shared cell is exactly what page 13 says** —
  upper marks *al hombre*, lower marks *en zona*. Every shared cell in the five
  figures obeys it once the page-9 rules are applied; the two that looked wrong
  are the rules working:
  - **Figura 3, C4** — Barbará is drawn *above* Solozábal even though Solozábal
    went to mark him (26), because Barbará's regate succeeded (27) and a
    successful regate inverts the marcaje: "el jugador con la pelota pasará a
    marcar al hombre al defensor (**se coloca encima**)".
  - **Figura 4/5, C5** — Solozábal is drawn *below* despite "M.H." (29) because
    his RB failed and Barbará declined to move, and then "el defensor pasará a
    realizar siempre un **marcaje en zona** al atacante".

  Same rule closes the Priority 2 question about play 30's dice form: it ends
  "el poseedor del balón se considerará **libre de cualquier tipo de marcaje**",
  which is precisely why the shot is the 1-die `5 + D1` form.

So **Figuras 1, 2 and 4 are the trustworthy snapshots**, and 3 and 5 each carry
known drafting errors. An engine fixture must follow the chronicle where they
disagree. Nothing on page 17 is open.

**Figuras 6–9 (pages 25, 26) are still untranscribed** — same treatment would
work: crop, rotate 90°, upscale.

---

## Priority 4 — Heavily underlined / reconstructed paragraphs

Prose that was hand-underlined or awkwardly split; meaning is clear but exact
wording should be checked:

- **Page 2** — the Guerrero card's **factor values** don't resolve even at 9×
  zoom. The label sequence looks like **RC · RG · PC · PL · LF · DL · RM**, but
  both the labels and their numbers need confirming against the physical card.
- **Page 5** — parts of the lower half are hand-underlined and hard to read;
  confirm against `scans/pages-04-05.jpeg`.
- **Page 23** — ✓ "Libres directos desde fuera del área": **confirmed and
  corrected** by the booklet owner. The dice rule was already right — **with**
  barrera → `D1 + D2 + LF`; **no** barrera (defender negligence) →
  `D1 + 5 + LF`. What was wrong was the wording: the attacking side asks for
  **"pasos"** (the regulation distance), not for "barrera"; it's the defender who
  then places or moves the barrera.
- **Page 23** — "Penalty": confirm keeper stops on a **6** (single die), no RF.
- **Page 29** — "Reglamento oficial del torneo": confirm the bullet list,
  especially **100-point** cap, **demarcación** (abilities only in zone except
  LF/RM/DL/RC), **3 foreigners**, 15-turn time limit.

---

## Confirmed OK (no action needed)

- Page numbering — cross-checked against the **índice** (pages 32–33). ✓
- All Juego Básico prose (pages 1–13) and Juego Avanzado prose (pages 18–22,
  24, 27–28) read cleanly.
