/**
 * The reducer: `apply(state, action, rng)` advances the match by exactly one action and
 * returns the new state plus the chronicle events it produced. It is pure — it clones,
 * mutates the clone, and never touches its argument — and it trusts `legalActions`:
 * every action is asserted to be legal, so the transition code applies geometry and
 * dice without re-checking rules.
 *
 * Dice come from the reused resolvers in `../engine` (TABLA 1/2 as data). Marcaje is
 * never written as a fact — it is a consequence of where the reducer puts players, read
 * back through `marcajeOf`. Where the rulebook and the old abstract engine disagree, the
 * rulebook wins: a FAILED regate hands the ball to the defender (page 9→10), which the
 * old `marcaje.ts#afterRegate` got wrong (it kept possession) but the worked example
 * never exercised.
 */

import type { Rng } from '../engine/rng'
import { abilityValue, keeperStats } from '../ratings'
import { resolvePase, resolvePaseHueco, resolveRegate, resolveShot } from '../engine/actions'
import { resolveAnticipacion, resolveRobo } from '../engine/interrupt'
import { resolveSave, isGoal } from '../engine/keeper'
import { ev, evContest, type EngineEvent } from '../engine/events'
import type { Cell } from '../engine/pitch'
import type { Action, PassKind } from './actions'
import { actionKey } from './actions'
import { legalActions, other, keeperId, carrier, playersOf } from './legal'
import { marcajeOf, markerOf, occupants, distance, cellKey, sameCell } from './derive'
import { autoPlace, kickoffCarrier } from './placement'
import type { MatchState, MatchPlayer, PlayerId, Marcaje, Side } from './state'

/** How many possession changes end the match (rulebook page 29). */
const TURNO_LIMIT = 15
/**
 * Jugadas one possession may run before it "breaks down" and the ball is conceded. Not a
 * rulebook number — a safety valve (see `MatchState.possessionJugadas`) set high enough
 * that ordinary human play never trips it, but low enough that the clock always advances.
 * (The rulebook's own stall brake, the page-29 "5 movimientos = un turno" rule, is
 * tournament-only — the basic-game worked example runs six movements in one turno — so it
 * is deliberately NOT applied here.)
 */
const POSSESSION_CAP = 24

const rate = (p: MatchPlayer, key: Parameters<typeof abilityValue>[1]): number =>
  abilityValue(p.card, key)

function clone(state: MatchState): MatchState {
  return structuredClone(state)
}

// ── geometry mutations ────────────────────────────────────────────────────────

/** Put the ball on a player; the ball's tracked cell follows the carrier. */
function giveBall(state: MatchState, id: PlayerId): void {
  state.ball = { carrier: id, cell: { ...state.players[id].cell } }
}

/**
 * Move a player into a cell, going ON TOP of any opponent already there (the universal
 * stacking rule, page 4). Vacating a shared cell leaves the other occupant alone.
 */
function stepInto(state: MatchState, moverId: PlayerId, cell: Cell): void {
  const mover = state.players[moverId]
  const oldCell = mover.cell
  const inPlace = sameCell(oldCell, cell) // a "flip on top in place" (robo case 2)
  mover.cell = { ...cell }
  const sharing = occupants(state, cell).filter((o) => o.id !== moverId)
  mover.onTop = sharing.length > 0
  for (const o of sharing) o.onTop = false
  // Whoever remains in the vacated cell is now alone — but only if the mover actually left.
  if (!inPlace) for (const o of occupants(state, oldCell)) o.onTop = false
  if (state.ball.carrier === moverId) state.ball.cell = { ...cell }
}

/** Swap two teammates (a relevo); both end up on top of any opponents (page 4). */
function relevo(state: MatchState, aId: PlayerId, bId: PlayerId): void {
  const a = state.players[aId]
  const b = state.players[bId]
  const ca = { ...a.cell }
  const cb = { ...b.cell }
  a.cell = cb
  b.cell = ca
  for (const mover of [a, b]) {
    const sharing = occupants(state, mover.cell).filter((o) => o.id !== mover.id)
    mover.onTop = sharing.length > 0
    for (const o of sharing) o.onTop = false
  }
  if (state.ball.carrier === aId) state.ball.cell = { ...a.cell }
  else if (state.ball.carrier === bId) state.ball.cell = { ...b.cell }
}

// ── clock ───────────────────────────────────────────────────────────────────

function endMatch(state: MatchState, events: EngineEvent[]): void {
  state.phase = { kind: 'fulltime' }
  events.push(ev('fulltime', 'home'))
}

/** Advance the possession clock; returns true (and ends the match) at the 15th change. */
function advanceTurno(state: MatchState, events: EngineEvent[]): boolean {
  state.turno += 1
  if (state.turno >= TURNO_LIMIT) {
    endMatch(state, events)
    return true
  }
  return false
}

function resetAntiStall(state: MatchState): void {
  state.antiStall = { pdChain: [], movedTo: {} }
}

/**
 * Hand possession to the other side and start their build-up. The caller has already
 * placed the ball and set any LIBRE flag; this flips the attacker, resets the
 * possession-scoped bookkeeping and advances the clock.
 *
 * `grantDefenderMove` covers the one case where the new attacker did not just act but
 * MOVED to take the ball — a defender reaching a failed pase al hueco (page 7). Since
 * that pickup was itself a movement, the OTHER side (the old attacker) earns its move
 * window first, mirroring the attacker-pickup branch of `applyHuecoMove`.
 */
function changePossession(state: MatchState, events: EngineEvent[], grantDefenderMove = false): void {
  state.attacker = other(state.attacker)
  resetAntiStall(state)
  state.possessionJugadas = 0
  if (advanceTurno(state, events)) return
  state.phase = grantDefenderMove
    ? { kind: 'defend_move', side: other(state.attacker) }
    : { kind: 'attack', side: state.attacker }
}

/** A stalled possession breaks down: the nearest opponent takes the ball (safety valve). */
function breakDown(state: MatchState, events: EngineEvent[]): void {
  const holder = carrier(state)
  const taker = playersOf(state, other(state.attacker))
    .filter((p) => p.id !== keeperId(other(state.attacker)))
    .sort((a, b) => distance(a.cell, holder.cell) - distance(b.cell, holder.cell))[0]
  events.push(ev('turnover', other(state.attacker), { player: taker.card.name }))
  giveBall(state, taker.id)
  state.libre = null
  changePossession(state, events)
}

// ── the reducer ───────────────────────────────────────────────────────────────

export function apply(
  state: MatchState,
  action: Action,
  rng: Rng,
): { state: MatchState; events: EngineEvent[] } {
  const next = clone(state)
  const events: EngineEvent[] = []

  // Placement's `place` is free-form and validated structurally; everything else must
  // be a member of the legal set, so the transitions below can trust the action.
  if (!(next.phase.kind === 'placement' && action.kind === 'place')) {
    const legal = legalActions(next)
    if (!legal.some((a) => actionKey(a) === actionKey(action))) {
      throw new Error(`illegal action in phase ${next.phase.kind}: ${actionKey(action)}`)
    }
  }

  dispatch(next, action, rng, events)
  return { state: next, events }
}

function dispatch(state: MatchState, action: Action, rng: Rng, events: EngineEvent[]): void {
  switch (state.phase.kind) {
    case 'placement':
      return applyPlacement(state, action)
    case 'kickoff':
      return applyKickoff(state, action, events)
    case 'attack':
      return applyAttack(state, action, rng, events)
    case 'defend_move':
      return applyDefendMove(state, action, rng, events)
    case 'defend_interrupt':
      return applyInterrupt(state, action, rng, events)
    case 'robo_advance':
      return applyRoboAdvance(state, action)
    case 'recovery_pick':
      return applyRecover(state, action, events)
    case 'hueco_move':
      return applyHuecoMove(state, action, events)
    case 'restart_move':
      return applyRestartMove(state, action)
    case 'keeper_restart':
      return applyKeeperRestart(state, action, rng, events)
    case 'fulltime':
      throw new Error('the match is over')
  }
}

// ── placement & kickoff ─────────────────────────────────────────────────────

function applyPlacement(state: MatchState, action: Action): void {
  if (action.kind === 'place') {
    for (const [id, cell] of Object.entries(action.cells)) {
      // The keeper never leaves the portería; ignore any attempt to move one.
      if (id === keeperId('home') || id === keeperId('away')) continue
      state.players[id] = { ...state.players[id], cell: { ...cell }, onTop: false }
    }
    return
  }
  // placement_done → hand off to the mandatory kickoff pase directo.
  const side = state.attacker
  const kicker = kickoffCarrier(state.players, side)
  giveBall(state, kicker)
  state.phase = { kind: 'kickoff', side }
}

function applyKickoff(state: MatchState, action: Action, events: EngineEvent[]): void {
  if (action.kind !== 'pass') return
  const from = carrier(state)
  giveBall(state, action.to)
  state.antiStall.pdChain = [from.id, action.to]
  events.push(ev('kickoff', state.attacker, { player: from.card.name, target: state.players[action.to].card.name }))
  state.phase = { kind: 'attack', side: state.attacker }
}

// ── attacker jugadas ─────────────────────────────────────────────────────────

function applyAttack(state: MatchState, action: Action, rng: Rng, events: EngineEvent[]): void {
  // A possession that never turns over would stall the clock; force a breakdown once it
  // runs past the budget (the human never gets near it — see POSSESSION_CAP).
  if (state.possessionJugadas >= POSSESSION_CAP) return breakDown(state, events)
  state.possessionJugadas += 1

  switch (action.kind) {
    case 'pass':
      return applyPass(state, action.pass, action.to, rng, events)
    case 'hueco':
      return applyHueco(state, action.pass, action.to, rng, events)
    case 'regate':
      return applyRegate(state, rng, events)
    case 'shot':
      return applyShot(state, action.shot, rng, events)
    case 'move':
      return applyMove(state, action.player, action.to, action.handoff ?? false)
    default:
      throw new Error(`unexpected attack action ${action.kind}`)
  }
}

function isKeeper(state: MatchState, id: PlayerId): boolean {
  return id === keeperId(state.players[id].side)
}

function applyPass(
  state: MatchState,
  pass: PassKind,
  to: PlayerId,
  rng: Rng,
  events: EngineEvent[],
): void {
  const from = carrier(state)
  const cesion = isKeeper(state, to)
  const passerMark = marcajeOf(state, from.id)
  state.libre = null // this jugada consumes the carrier's libre flag

  if (pass === 'PD') {
    // Automatic. Completes with no dice; marks unchanged.
    giveBall(state, to)
    if (!state.antiStall.pdChain.includes(from.id)) state.antiStall.pdChain.push(from.id)
    state.antiStall.pdChain.push(to)
    events.push(ev('pass', state.attacker, { player: from.card.name, target: state.players[to].card.name, ability: 'pc' }))
    if (cesion) return keeperFootRestart(state)
    state.phase = { kind: 'attack', side: state.attacker }
    return
  }

  // PC / PL — a contested pass. Dice = max(passer, receiver) per TABLA 1.
  const receiverMark = marcajeOf(state, to)
  const ratingKey = pass === 'PL' ? 'pl' : 'pc'
  // The passer's own PC/PL always counts, cesión or not: page 11's "sus factores PC y PL
  // son cero" is the KEEPER's rating when HE plays the ball (handled in the keeper restart),
  // not a penalty on the field player ceding back to him.
  const rating = rate(from, ratingKey)
  const contest = resolvePase(rng, pass, passerMark, receiverMark, rating)
  // A non-direct pass breaks both anti-stall runs.
  state.antiStall.pdChain = []

  if (contest.success) {
    giveBall(state, to)
    events.push(
      evContest('pass', state.attacker, {
        player: from.card.name,
        target: state.players[to].card.name,
        ability: ratingKey,
        contest,
        cell: state.players[to].cell,
      }),
    )
    if (cesion) return keeperFootRestart(state)
    // A marked receiver can be interrupted (page 8/9).
    if (receiverMark === 'MZ' || receiverMark === 'MH') {
      state.phase = { kind: 'defend_interrupt', side: other(state.attacker), receiver: to }
      return
    }
    state.phase = { kind: 'attack', side: state.attacker }
    return
  }

  // Failed cesión via PC/PL is an own goal (page 11).
  if (cesion) {
    events.push(evContest('turnover', state.attacker, { player: from.card.name, ability: ratingKey, contest, cell: from.cell }))
    return concede(state, other(state.attacker), events)
  }
  // Failed PC/PL: the defence recovers (page 7).
  events.push(evContest('turnover', state.attacker, { player: from.card.name, ability: ratingKey, contest, cell: from.cell }))
  recoverFailedPass(state, to, receiverMark, events)
}

function applyRegate(state: MatchState, rng: Rng, events: EngineEvent[]): void {
  const self = carrier(state)
  const mark = marcajeOf(state, self.id)
  const defender = markerOf(state, self.id)!
  state.libre = null
  state.antiStall.pdChain = []
  const contest = resolveRegate(rng, mark, rate(self, 'rg'))
  events.push(
    evContest('dribble', state.attacker, {
      player: self.card.name,
      ability: 'rg',
      marcaje: mark,
      contest,
      cell: self.cell,
    }),
  )
  if (contest.success) {
    // The carrier goes on top of the defender and is libre next jugada (page 9).
    self.onTop = true
    defender.onTop = false
    state.libre = self.id
    state.phase = { kind: 'attack', side: state.attacker }
    return
  }
  // Failure (page 9→10): the attacker drops below, the DEFENDER takes the ball and is
  // libre next jugada. This is the transition the old engine got wrong.
  self.onTop = false
  defender.onTop = true
  giveBall(state, defender.id)
  state.libre = defender.id
  changePossession(state, events)
}

function applyShot(state: MatchState, shot: 'RM' | 'DL', rng: Rng, events: EngineEvent[]): void {
  const self = carrier(state)
  const mark = marcajeOf(state, self.id)
  state.libre = null
  state.antiStall.pdChain = []
  const rating = rate(self, shot === 'RM' ? 'rm' : 'dl')
  const contest = resolveShot(rng, shot, mark, rating)
  if (!contest.success) {
    events.push(evContest('shot', state.attacker, { player: self.card.name, ability: shot === 'RM' ? 'rm' : 'dl', marcaje: mark, contest, cell: self.cell }))
    return keeperRestartAfterShot(state, events)
  }
  // On target → the keeper tries to save.
  const keeper = state.players[keeperId(other(state.attacker))]
  const stat = shot === 'RM' ? keeperStats(keeper.card).rf : keeperStats(keeper.card).co
  const { contest: saveContest, saved } = resolveSave(rng, stat)
  if (isGoal(true, saved)) {
    events.push(evContest('goal', state.attacker, { player: self.card.name, ability: shot === 'RM' ? 'rm' : 'dl', contest, cell: self.cell }))
    return concede(state, state.attacker, events)
  }
  events.push(evContest('save', other(state.attacker), { player: keeper.card.name, ability: shot === 'RM' ? 'rf' : 'co', contest: saveContest, cell: self.cell }))
  keeperRestartAfterShot(state, events)
}

function applyMove(state: MatchState, playerId: PlayerId, to: Cell, handoff: boolean): void {
  const mover = state.players[playerId]
  const wasCarrier = state.ball.carrier === playerId
  const target = occupants(state, to).find((o) => o.side === mover.side && o.id !== playerId)
  if (target) relevo(state, playerId, target.id)
  else stepInto(state, playerId, to)
  // Relevo con balón, hand-off variant (page 4): the carrier swaps and leaves the ball on
  // the teammate he swapped with, rather than carrying it. `relevo` kept the ball on the
  // mover; move it across. The worked example needs this at play 48 (Kiko ↔ Francisco,
  // "cogiendo el balón Francisco").
  if (handoff && wasCarrier && target) giveBall(state, target.id)
  // A movement ends the current run of pases directos: the "sucesión de pases directos"
  // the reuse rule (page 12) forbids is a run of CONSECUTIVE PDs, so any non-PD play
  // breaks it. The worked example relies on this — plays 14–16 re-pass to players from
  // the plays 1–3 chain, legal only because the intervening moves reset the run.
  state.antiStall.pdChain = []
  // Record the move so the same player can't be sent to the same cell twice (page 12).
  ;(state.antiStall.movedTo[playerId] ??= []).push(cellKey(to))

  // The carrier's own movement IS his jugada, so it consumes any "libre de marcaje" grace
  // he was carrying. Page 4 makes being libre the PRECONDITION to move the ball, never a
  // consequence: a carrier who steps onto a defender ends up marked en zona (the opponent
  // below him), not free. Granting libre here was a bug — it left Barbará reading LIBRE
  // three plays later and made his regate (worked example play 27) illegal.
  if (wasCarrier) state.libre = null

  // Any attacker movement grants the defender a move window (page 5).
  state.phase = { kind: 'defend_move', side: other(state.attacker) }
}

function applyHueco(state: MatchState, pass: Exclude<PassKind, 'PD'>, to: Cell, rng: Rng, events: EngineEvent[]): void {
  const from = carrier(state)
  state.libre = null
  state.antiStall.pdChain = []
  const contest = resolvePaseHueco(rng, rate(from, pass === 'PL' ? 'pl' : 'pc'))
  // The ball goes loose on the target cell either way; the roll only decides who moves
  // toward it first (pages 7–8).
  state.ball = { carrier: null, cell: { ...to } }
  events.push(evContest('pass', state.attacker, { player: from.card.name, ability: pass === 'PL' ? 'pl' : 'pc', contest, cell: to }))
  const first = contest.success ? state.attacker : other(state.attacker)
  state.phase = { kind: 'hueco_move', side: first }
}

// ── failed-pass recovery (page 7) ──────────────────────────────────────────────

function recoverFailedPass(state: MatchState, receiver: PlayerId, receiverMark: Marcaje, events: EngineEvent[]): void {
  const def = other(state.attacker)
  // (1) A marked receiver → his marker takes the ball, on top.
  if (receiverMark === 'MH' || receiverMark === 'MZ') {
    const marker = markerOf(state, receiver)
    if (marker) {
      marker.onTop = true
      state.players[receiver].onTop = false
      giveBall(state, marker.id)
      state.libre = null
      return changePossession(state, events)
    }
  }
  // (2) Otherwise the nearest defender in line or behind the receiver — "behind" meaning
  // goalside, toward the defending team's own goal (which is why the rulebook says the
  // keeper can recover: he is the deepest goalside defender). Ties break to the one
  // furthest back; several still equal → the defender chooses (page 7).
  const recCell = state.players[receiver].cell
  // The attack runs toward the defenders' goal; "behind the receiver" is further along it.
  const attackDir = state.attacker === 'home' ? 1 : -1
  const goalside = (row: number): number => (row - recCell.row) * attackDir
  const candidates = playersOf(state, def).filter((p) => goalside(p.cell.row) >= 0)
  const minDist = Math.min(...candidates.map((p) => distance(p.cell, recCell)))
  let best = candidates.filter((p) => distance(p.cell, recCell) === minDist)
  if (best.length > 1) {
    // Prefer the one furthest goalside; if that is unique, take it, else the defender picks.
    const deepest = Math.max(...best.map((p) => goalside(p.cell.row)))
    const behind = best.filter((p) => goalside(p.cell.row) === deepest)
    if (behind.length === 1) best = behind
  }
  if (best.length > 1) {
    state.phase = { kind: 'recovery_pick', side: def, candidates: best.map((p) => p.id) }
    return
  }
  finishRecovery(state, best[0].id, events)
}

function finishRecovery(state: MatchState, recovererId: PlayerId, events: EngineEvent[]): void {
  giveBall(state, recovererId)
  state.libre = null
  changePossession(state, events)
}

function applyRecover(state: MatchState, action: Action, events: EngineEvent[]): void {
  if (action.kind !== 'recover') return
  finishRecovery(state, action.player, events)
}

// ── defender reactions ─────────────────────────────────────────────────────────

function applyDefendMove(state: MatchState, action: Action, rng: Rng, events: EngineEvent[]): void {
  if (action.kind === 'decline') {
    state.phase = { kind: 'attack', side: state.attacker }
    return
  }
  if (action.kind === 'move') {
    const mover = state.players[action.player]
    const target = occupants(state, action.to).find((o) => o.side === mover.side && o.id !== action.player)
    if (target) relevo(state, action.player, target.id)
    else stepInto(state, action.player, action.to)
    state.phase = { kind: 'attack', side: state.attacker }
    return
  }
  if (action.kind === 'robo') {
    // Case 2 (move onto the holder) or case 3 (renounce the move); both roll RB.
    if (action.mode === 'move-onto' && action.to) stepInto(state, action.defender, action.to)
    return applyRobo(state, action.defender, rng, events)
  }
}

function applyInterrupt(state: MatchState, action: Action, rng: Rng, events: EngineEvent[]): void {
  if (action.kind === 'decline') {
    state.phase = { kind: 'attack', side: state.attacker }
    return
  }
  if (action.kind === 'anticipacion') return applyAnticipacion(state, action.defender, rng, events)
  if (action.kind === 'robo') return applyRobo(state, action.defender, rng, events)
}

function applyAnticipacion(state: MatchState, defenderId: PlayerId, rng: Rng, events: EngineEvent[]): void {
  const defender = state.players[defenderId]
  const receiver = carrier(state)
  const contest = resolveAnticipacion(rng, rate(defender, 'a'))
  if (contest.success) {
    // Anticipator takes the ball, on top, libre next jugada (page 8).
    defender.onTop = true
    receiver.onTop = false
    giveBall(state, defender.id)
    state.libre = defender.id
    events.push(evContest('interception', defender.side, { player: defender.card.name, ability: 'a', contest, cell: defender.cell }))
    return changePossession(state, events)
  }
  // Failure: a man-marker drops to zona; either way the attacker is libre (page 8).
  if (defender.onTop) defender.onTop = false // demote MH → MZ
  state.libre = receiver.id
  events.push(evContest('turnover', defender.side, { ability: 'a', contest, cell: defender.cell }))
  state.phase = { kind: 'attack', side: state.attacker }
}

function applyRobo(state: MatchState, defenderId: PlayerId, rng: Rng, events: EngineEvent[]): void {
  const defender = state.players[defenderId]
  const holder = carrier(state)
  const contest = resolveRobo(rng, rate(defender, 'rb'))
  if (contest.success) {
    // Defender takes the ball, always marking al hombre (page 9): on top of the ex-holder.
    defender.onTop = true
    holder.onTop = false
    giveBall(state, defender.id)
    state.libre = null
    events.push(evContest('steal', defender.side, { player: defender.card.name, ability: 'rb', contest, cell: defender.cell }))
    return changePossession(state, events)
  }
  // Failure: the attacker may advance a cell (page 9) — a decision.
  events.push(evContest('turnover', defender.side, { ability: 'rb', contest, cell: defender.cell }))
  state.phase = { kind: 'robo_advance', side: state.attacker }
}

function applyRoboAdvance(state: MatchState, action: Action): void {
  const holder = carrier(state)
  if (action.kind === 'robo_advance') {
    // Advance with the ball to an adjacent cell — explicitly NOT a movement (page 9).
    stepInto(state, holder.id, action.to)
    state.libre = holder.id
    state.phase = { kind: 'attack', side: state.attacker }
    return
  }
  // Declined: the defender drops to zona (below), the holder is libre next jugada.
  const marker = markerOf(state, holder.id)
  if (marker) {
    marker.onTop = false
    holder.onTop = true
  }
  state.libre = holder.id
  state.phase = { kind: 'attack', side: state.attacker }
}

function applyHuecoMove(state: MatchState, action: Action, events: EngineEvent[]): void {
  const looseCell = state.ball.cell
  if (action.kind === 'move') {
    stepInto(state, action.player, action.to)
    // Whoever reaches the loose cell picks up the ball.
    if (cellKey(action.to) === cellKey(looseCell)) {
      const picker = state.players[action.player]
      giveBall(state, picker.id)
      if (picker.side === state.attacker) {
        // Reaching the ball was itself a movement, so the defender earns a move window
        // (page 5). The worked example relies on this: Vizcaíno picks up the hueco ball
        // (play 34), then Tocornal — the defender — moves onto Francisco (play 35).
        state.phase = { kind: 'defend_move', side: other(state.attacker) }
      } else {
        // The defender reached it: possession changes to them, and by the same "reaching
        // was a movement" logic the old attacker now gets its move window (play 40 Bjelica
        // picks up → play 41 Kiko moves onto him).
        state.libre = null
        return changePossession(state, events, true)
      }
      return
    }
  }
  // Moved elsewhere, or declined: the possession-holder resumes; the ball stays loose on
  // its cell until reached. For simplicity the attacker resumes control of the tempo.
  if (state.ball.carrier === null) {
    // Nobody reached it yet — hand the tempo to the attacker to try again.
    const nearest = nearestTo(state, state.attacker, looseCell)
    giveBall(state, nearest)
  }
  state.phase = { kind: 'attack', side: state.attacker }
}

function nearestTo(state: MatchState, side: Side, cell: Cell): PlayerId {
  return playersOf(state, side)
    .filter((p) => p.id !== keeperId(side))
    .sort((a, b) => distance(a.cell, cell) - distance(b.cell, cell))[0].id
}

// ── keeper restart & cesión ─────────────────────────────────────────────────────

/** After a miss/save, possession passes to the defending side and their keeper restarts. */
function keeperRestartAfterShot(state: MatchState, events: EngineEvent[]): void {
  state.attacker = other(state.attacker)
  resetAntiStall(state)
  state.possessionJugadas = 0
  if (advanceTurno(state, events)) return
  giveBall(state, keeperId(state.attacker))
  // One player per team may reposition first (page 11): restarting side, then the other.
  state.phase = { kind: 'restart_move', side: state.attacker }
}

/** A successful cesión: the keeper must play it immediately with his foot — no premove. */
function keeperFootRestart(state: MatchState): void {
  const side = state.attacker
  giveBall(state, keeperId(side))
  state.phase = { kind: 'keeper_restart', side }
}

function applyRestartMove(state: MatchState, action: Action): void {
  const restartSide = state.attacker
  const doneSide = (state.phase as { side: Side }).side
  if (action.kind === 'premove') {
    const mover = state.players[action.player]
    const target = occupants(state, action.to).find((o) => o.side === mover.side && o.id !== action.player)
    if (target) relevo(state, action.player, target.id)
    else stepInto(state, action.player, action.to)
  }
  // Sequence: restarting side premoves, then the opponent, then the keeper restarts.
  if (doneSide === restartSide) {
    state.phase = { kind: 'restart_move', side: other(restartSide) }
  } else {
    giveBall(state, keeperId(restartSide))
    state.phase = { kind: 'keeper_restart', side: restartSide }
  }
}

function applyKeeperRestart(state: MatchState, action: Action, rng: Rng, events: EngineEvent[]): void {
  const side = state.attacker
  const keeper = state.players[keeperId(side)]
  if (action.kind === 'keeper_pass') {
    const receiver = state.players[action.to]
    if (action.pass === 'PD') {
      giveBall(state, action.to)
    } else {
      // The keeper's own PC/PL count as zero (page 11).
      const contest = resolvePase(rng, action.pass, 'SM', marcajeOf(state, action.to), 0)
      events.push(evContest('pass', side, { player: keeper.card.name, target: receiver.card.name, ability: action.pass === 'PL' ? 'pl' : 'pc', contest, cell: receiver.cell }))
      if (!contest.success) return recoverFailedPass(state, action.to, marcajeOf(state, action.to), events)
      giveBall(state, action.to)
    }
    state.phase = { kind: 'attack', side }
    return
  }
  if (action.kind === 'keeper_hueco') {
    const contest = resolvePaseHueco(rng, 0)
    state.ball = { carrier: null, cell: { ...action.to } }
    events.push(evContest('pass', side, { player: keeper.card.name, ability: action.pass === 'PL' ? 'pl' : 'pc', contest, cell: action.to }))
    state.phase = { kind: 'hueco_move', side: contest.success ? side : other(side) }
    return
  }
}

// ── goals ────────────────────────────────────────────────────────────────────

/** Award a goal to `scorer`, then re-place both sides and give the conceding side kickoff. */
function concede(state: MatchState, scorer: Side, events: EngineEvent[]): void {
  if (scorer === 'home') state.score.home += 1
  else state.score.away += 1
  if (advanceTurno(state, events)) return
  // Full re-placement per colocación inicial (page 5): auto-arrange both sides afresh.
  const conceding = other(scorer)
  state.players = { ...autoPlace(homeSquadOf(state), 'home'), ...autoPlace(awaySquadOf(state), 'away') }
  state.attacker = conceding
  resetAntiStall(state)
  state.possessionJugadas = 0
  state.libre = null
  const kicker = kickoffCarrier(state.players, conceding)
  giveBall(state, kicker)
  state.phase = { kind: 'kickoff', side: conceding }
}

/** Reconstruct a side's EngineSquad from the players on the board (for re-placement). */
function squadOf(state: MatchState, side: Side): import('../engine/types').EngineSquad {
  const ps = playersOf(state, side).sort((a, b) => a.id.localeCompare(b.id))
  const keeper = state.players[keeperId(side)].card
  const outfield = ps.filter((p) => p.id !== keeperId(side)).map((p) => p.card)
  return { name: side, outfield, keeper }
}
const homeSquadOf = (s: MatchState) => squadOf(s, 'home')
const awaySquadOf = (s: MatchState) => squadOf(s, 'away')
