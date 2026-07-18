# Deviations & scope

The match engine (`src/game/board/`) implements the rulebook's **Juego Básico** (pages
1–13). This note records the few places where it departs from the paper rules, and the
in-scope simplifications. Everything not listed here follows the transcription in `pages/`;
where code and the paper rules disagree and it is **not** listed here, the paper rules win
(see `README.md`).

## Deviation — the 15-turno tournament clock, not win-by-two

The basic game ends when a side leads **by two goals** (page 12, «ganar por dos goles de
diferencia»). That is **unbounded** — a level game can run forever — which is unshippable on
a phone. So the engine imports the **tournament clock from page 29** instead:

> Se juega a tiempo, esto es, a 15 turnos. Cuando éste cambie de los jugadores de un equipo
> al otro 15 veces, termina el partido.

i.e. the match ends after **15 changes of possession** (the turno passing from one side to
the other 15 times, ~7–8 possessions each). `MatchState.turno` counts those changes; at 15
the **highest score wins, draws allowed**. This is a genuine rulebook citation, not a house
rule, so the "rulebook decides" convention still holds.

Page 29's **companion anti-stall** («¡MUY importante!», page 12) comes along with the clock
for the same reason: it is the only brake on an otherwise unbounded possession.

**Correction that made this readable:** page 29's clock line had been mis-transcribed — the
«(cambie de los jugadores)» flagged as illegible was the sentence itself, truncated.
`pages/page-29.md` and `VERIFICATION.md` were corrected against `scans/pages-28-29.jpeg`.

## In scope, but faithfully simplified

- **Demarcación is absent — and that is faithful.** Page 11 opens the basic modality with
  «Las características básicas de los jugadores sirven en todo el campo (**se juega sin
  demarcación**).» So the basic game deliberately does not use the demarcación
  (marking-by-zone-assignment) layer; the engine matches it. Noted only because the advanced
  game (pages 18+) adds demarcación back.

## Out of scope — the Juego Avanzado (pages 18+)

- **PA (pases altos).** The board tags the DL-ring cells the page-1 diagram labels **PA+DL**
  (cols 1 and 3 of the ring) as plain **DL**: the basic game only needs RM/DL shot-legality,
  and pases altos are an advanced-game pass. Encode the PA+DL overlap when the advanced game
  lands (see the note in `src/game/engine/pitch.ts`).
- Everything else from page 18 on — advanced marcaje/demarcación, substitutions, and the
  rest of the Juego Avanzado — is not implemented.
