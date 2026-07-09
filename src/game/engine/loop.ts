import type { Rng } from './rng'
import type { Difficulty } from '@/game/engine'
import type { EngineCard, EngineSquad, Marcaje, Side } from './types'
import { initialPitch, type Pitch } from './pitch'
import { abilityValue, keeperStats } from '@/game/ratings'
import { resolvePase, resolvePaseHueco, resolveRegate, resolveShot } from './actions'
import { resolveAnticipacion, resolveRobo } from './interrupt'
import { resolveSave, isGoal } from './keeper'
import { afterAnticipacion, afterRegate, afterRobo } from './marcaje'
import { chooseAttack, chooseInterrupt, pressAfterMove, tuning } from './ai'
import { ev, evContest, type EngineEvent } from './events'
import type { AttackChoice } from './ai'

/** Match ends as soon as one side leads by this margin (rulebook page 12). */
const WIN_MARGIN = 2
/** Safety cap so an evenly matched pair can never loop forever. */
const MAX_POSSESSIONS = 80
/** Jugadas a single possession may run before it "breaks down". */
const JUGADA_BUDGET = 10

export interface MatchState {
  home: EngineSquad
  away: EngineSquad
  difficulty: Difficulty
  attacker: Side
  pitch: Pitch
  carrier: EngineCard
  carrierMark: Marcaje
  gf: number // home goals
  ga: number // away goals
  minute: number
  possessions: number
}

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

function squadOf(state: MatchState, side: Side): EngineSquad {
  return side === 'home' ? state.home : state.away
}

/** The manager fields their best specialist for a defensive action. */
function defenderBest(squad: EngineSquad, key: Parameters<typeof abilityValue>[1]): number {
  return squad.outfield.reduce((best, c) => Math.max(best, abilityValue(c, key)), 0)
}

function pickOther(rng: Rng, xs: EngineCard[], exclude: EngineCard): EngineCard {
  if (xs.length <= 1) return xs[0]
  let c = rng.pick(xs)
  while (c === exclude) c = rng.pick(xs)
  return c
}

/** Marcaje imposed on a pass receiver by the defence (pressing). */
function pressReceiver(rng: Rng, difficulty: Difficulty): Marcaje {
  const t = tuning(difficulty)
  if (!rng.chance(t.press)) return 'SM'
  return rng.chance(t.press) ? 'MH' : 'MZ'
}

interface PossessionResult {
  scored: boolean
  /** Whether the NEXT possession is a kickoff (true only after a goal). */
  kickoff: boolean
}

type ChoiceOutcome = 'continue' | 'turnover' | 'goal'

/** Apply one attacker jugada, mutating state and emitting events. */
function applyChoice(
  state: MatchState,
  rng: Rng,
  events: EngineEvent[],
  choice: AttackChoice,
): ChoiceOutcome {
  const atkSide = state.attacker
  const defSquad = squadOf(state, other(atkSide))

  switch (choice.kind) {
    case 'advance': {
      state.pitch = state.pitch.step(1)
      state.carrierMark = pressAfterMove(rng, state.carrierMark, state.difficulty)
      return 'continue'
    }

    case 'regate': {
      const rg = abilityValue(state.carrier, 'rg')
      const contest = resolveRegate(rng, state.carrierMark, rg)
      events.push(
        evContest('dribble', atkSide, {
          player: state.carrier.name,
          ability: 'rg',
          marcaje: state.carrierMark,
          contest,
        }),
      )
      const outcome = afterRegate(contest.success)
      state.carrierMark = outcome.carrier
      if (contest.success) state.pitch = state.pitch.step(1)
      return 'continue'
    }

    case 'pase':
    case 'hueco': {
      const type = choice.type
      const rating = abilityValue(state.carrier, type === 'PL' ? 'pl' : 'pc')
      const receiver = pickOther(rng, squadOf(state, atkSide).outfield, state.carrier)
      const receiverMark = choice.kind === 'hueco' ? 'LIBRE' : pressReceiver(rng, state.difficulty)
      const contest =
        choice.kind === 'hueco'
          ? resolvePaseHueco(rng, rating)
          : resolvePase(rng, type, state.carrierMark, receiverMark, rating)

      if (!contest.success) {
        // Failed pass → the defence recovers the ball (pages 5–8).
        events.push(
          evContest('turnover', atkSide, {
            player: state.carrier.name,
            ability: type === 'PL' ? 'pl' : 'pc',
            contest,
          }),
        )
        flip(state)
        return 'turnover'
      }

      // Completed pass: the ball moves forward to the receiver.
      state.carrier = receiver
      state.carrierMark = receiverMark
      state.pitch = state.pitch.step(1)

      // A marked receiver can be interrupted (only zonal → anticipación, only
      // man → robo; rulebook pages 8–9).
      if (choice.kind === 'pase' && (receiverMark === 'MZ' || receiverMark === 'MH')) {
        const decision = chooseInterrupt(rng, receiverMark, state.difficulty)
        if (decision === 'anticipacion') {
          const contestA = resolveAnticipacion(rng, defenderBest(defSquad, 'a'))
          const res = afterAnticipacion(contestA.success)
          if (res.possession === 'defender') {
            events.push(evContest('interception', other(atkSide), { ability: 'a', contest: contestA }))
            flip(state)
            return 'turnover'
          }
          state.carrierMark = res.carrier // attacker keeps ball, now libre
        } else if (decision === 'robo') {
          const contestR = resolveRobo(rng, defenderBest(defSquad, 'rb'))
          const res = afterRobo(contestR.success)
          if (res.possession === 'defender') {
            events.push(evContest('steal', other(atkSide), { ability: 'rb', contest: contestR }))
            flip(state)
            return 'turnover'
          }
          state.carrierMark = res.carrier
        }
      }
      return 'continue'
    }

    case 'shot': {
      const action = choice.action
      const rating = abilityValue(state.carrier, action === 'RM' ? 'rm' : 'dl')
      const contest = resolveShot(rng, action, state.carrierMark, rating)
      if (!contest.success) {
        // Fuera de gol → the defending keeper restarts (possession flips).
        events.push(
          evContest('shot', atkSide, {
            player: state.carrier.name,
            ability: action === 'RM' ? 'rm' : 'dl',
            marcaje: state.carrierMark,
            contest,
          }),
        )
        flip(state)
        return 'turnover'
      }
      // On target → the keeper tries to save.
      const keeper = squadOf(state, other(atkSide)).keeper
      const stat = action === 'RM' ? keeperStats(keeper).rf : keeperStats(keeper).co
      const { contest: saveContest, saved } = resolveSave(rng, stat)
      if (isGoal(true, saved)) {
        events.push(
          evContest('goal', atkSide, {
            player: state.carrier.name,
            ability: action === 'RM' ? 'rm' : 'dl',
            contest,
          }),
        )
        return 'goal'
      }
      events.push(
        evContest('save', other(atkSide), {
          player: keeper.name,
          ability: action === 'RM' ? 'rf' : 'co',
          contest: saveContest,
        }),
      )
      flip(state)
      return 'turnover'
    }
  }
}

/** Hand the ball to the other side (a turnover), starting a fresh build-up. */
function flip(state: MatchState): void {
  state.attacker = other(state.attacker)
}

/** Run one possession from midfield until a goal, turnover, or break-down. */
function runPossession(
  state: MatchState,
  rng: Rng,
  events: EngineEvent[],
  kickoff: boolean,
): PossessionResult {
  const squad = squadOf(state, state.attacker)
  state.pitch = initialPitch()
  state.carrier = rng.pick(squad.outfield)
  state.carrierMark = 'SM'
  state.minute = Math.min(120, state.minute + rng.int(4) + 1)

  if (kickoff) {
    events.push(ev('kickoff', state.attacker, { player: state.carrier.name }))
    // Mandatory pase directo to the adjacent player (automatic, page 12).
    state.carrier = pickOther(rng, squad.outfield, state.carrier)
  }

  for (let budget = JUGADA_BUDGET; budget > 0; budget--) {
    const choice = chooseAttack(rng, state.pitch.band, state.carrierMark, state.carrier, state.difficulty)
    const outcome = applyChoice(state, rng, events, choice)
    if (outcome === 'goal') {
      if (state.attacker === 'home') state.gf++
      else state.ga++
      // The conceding side kicks off next.
      state.attacker = other(state.attacker)
      return { scored: true, kickoff: true }
    }
    if (outcome === 'turnover') return { scored: false, kickoff: false }
  }
  // Possession broke down: hand it over.
  flip(state)
  return { scored: false, kickoff: false }
}

function terminated(state: MatchState): boolean {
  return Math.abs(state.gf - state.ga) >= WIN_MARGIN || state.possessions >= MAX_POSSESSIONS
}

/** Play a whole match to a two-goal margin (or the safety cap). */
export function runMatch(state: MatchState, rng: Rng): { events: EngineEvent[]; minutes: number[] } {
  const events: EngineEvent[] = []
  const minutes: number[] = []
  // Stamp every not-yet-stamped event with the current possession's minute.
  const stamp = () => {
    while (minutes.length < events.length) minutes.push(state.minute)
  }

  let kickoff = true // the very first possession is a kickoff
  while (!terminated(state)) {
    const result = runPossession(state, rng, events, kickoff)
    stamp()
    kickoff = result.kickoff // only a goal makes the next possession a kickoff
    state.possessions++
  }

  events.push(ev('fulltime', 'home'))
  stamp()
  return { events, minutes }
}
