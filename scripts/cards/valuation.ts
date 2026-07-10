// Market value -> overall(30..99) derivation.
//
// A faithful TypeScript port of virtua-fc's PlayerValuationService
// (app/Modules/Player/Services/PlayerValuationService.php): same anchor tables,
// same log-space interpolation, same age adjustment. Keeping the two in sync is
// deliberate — both projects should rate a given player identically. The seeding
// correction strengths come from virtua-fc's config/player.php.
//
// All monetary values are in *cents* (euros × 100), exactly as the PHP.

/** [ability, valueCents] anchors, ascending. The economy value→ability proxy. */
const ABILITY_VALUE_ANCHORS: [number, number][] = [
  [45, 10_000_000], // €100K
  [50, 30_000_000], // €300K
  [58, 100_000_000], // €1M
  [63, 200_000_000], // €2M
  [68, 500_000_000], // €5M
  [73, 1_000_000_000], // €10M
  [78, 2_500_000_000], // €25M
  [83, 5_000_000_000], // €50M
  [88, 8_000_000_000], // €80M
  [92, 12_000_000_000], // €120M
  [95, 15_000_000_000], // €150M
]

/** Higher-floored SoFIFA-derived curve, blended in by `competenceFloor`. */
const COMPETENCE_FLOOR_ANCHORS: [number, number][] = [
  [55, 5_000_000], // €50k
  [62, 10_000_000], // €100k
  [67, 50_000_000], // €500k
  [69, 100_000_000], // €1M
  [71, 200_000_000], // €2M
  [73, 400_000_000], // €4M
  [75, 800_000_000], // €8M
  [77, 1_600_000_000], // €16M
  [80, 3_100_000_000], // €31M
  [84, 6_000_000_000], // €60M
  [88, 10_000_000_000], // €100M
  [92, 18_000_000_000], // €180M
]

// Keepers trade below outfielders for equal quality; scale value up before mapping.
const GOALKEEPER_VALUE_MULTIPLIER = 2.0
const SKILL_PERSISTENCE_SLOPE = 0.6
const MAX_AGE_BOOST = 12
// PlayerAge.php
const YOUNG_END = 23
const PRIME_END = 34

// Seeding correction strengths — virtua-fc config/player.php `market_value_corrections`.
export const SEED_CORRECTIONS = {
  competenceFloor: 0.7,
  skillPersistence: 1.0,
  youthTalentCredit: 0.5,
} as const

/** Log-space interpolation of ability against a value-anchor table (PHP interpolateAbility). */
function interpolateAbility(valueCents: number, anchors: [number, number][]): number {
  if (valueCents <= anchors[0][1]) return anchors[0][0]
  const last = anchors.length - 1
  if (valueCents >= anchors[last][1]) return anchors[last][0]
  for (let i = 0; i < last; i++) {
    const [aLow, vLow] = anchors[i]
    const [aHigh, vHigh] = anchors[i + 1]
    if (valueCents >= vLow && valueCents <= vHigh) {
      const t = (Math.log(valueCents) - Math.log(vLow)) / (Math.log(vHigh) - Math.log(vLow))
      return aLow + t * (aHigh - aLow)
    }
  }
  return anchors[0][0]
}

/** Legacy veteran boost (skillPersistence = 0 endpoint). Ported verbatim. */
function legacyVeteranBoost(effectiveValueCents: number, age: number): number {
  if (age <= PRIME_END - 3) return 0
  const typicalValueForAge =
    age <= 33 ? 500_000_000 : age <= 35 ? 300_000_000 : age <= 37 ? 150_000_000 : 80_000_000
  const valueRatio = effectiveValueCents / Math.max(1, typicalValueForAge)
  if (valueRatio >= 10) return 12
  if (valueRatio >= 5) return 8
  if (valueRatio >= 3) return 5
  if (valueRatio >= 2) return 3
  if (valueRatio >= 1) return 1
  return 0
}

/** Age-adjust the raw value-implied ability into a final overall (PHP adjustAbilityForAge). */
function adjustAbilityForAge(
  rawAbility: number,
  effectiveValueCents: number,
  age: number,
  skillPersistence: number,
  youthTalentCredit: number,
): number {
  if (age < YOUNG_END) {
    // Base cap rises with age: 17yo = 75, 22yo = 85. Soften by crediting a
    // fraction of the value-implied ability above the cap.
    const ageCap = 75 + (age - 17) * 2
    const softenedCap = ageCap + youthTalentCredit * Math.max(0, rawAbility - ageCap)
    return Math.round(Math.min(rawAbility, softenedCap))
  }
  const legacyBoost = legacyVeteranBoost(effectiveValueCents, age)
  const persistenceBoost = SKILL_PERSISTENCE_SLOPE * Math.max(0, age - 27)
  const boost = Math.min(
    MAX_AGE_BOOST,
    (1 - skillPersistence) * legacyBoost + skillPersistence * persistenceBoost,
  )
  return Math.round(Math.min(95, rawAbility + boost))
}

/**
 * Convert a market value (cents) + age + keeper flag into a single overall_score.
 * Deterministic: the PHP's ±1 jitter is intentionally dropped for reproducible seeds.
 */
export function marketValueToOverall(
  valueCents: number,
  age: number,
  isGoalkeeper: boolean,
  corrections = SEED_CORRECTIONS,
): number {
  const effectiveValue = isGoalkeeper ? Math.round(valueCents * GOALKEEPER_VALUE_MULTIPLIER) : valueCents
  const rawProxy = interpolateAbility(effectiveValue, ABILITY_VALUE_ANCHORS)
  const rawFloored = interpolateAbility(effectiveValue, COMPETENCE_FLOOR_ANCHORS)
  const rawAbility =
    (1 - corrections.competenceFloor) * rawProxy + corrections.competenceFloor * rawFloored
  return adjustAbilityForAge(
    rawAbility,
    effectiveValue,
    age,
    corrections.skillPersistence,
    corrections.youthTalentCredit,
  )
}

/** Fallback when a player has no market value listed. */
export const DEFAULT_MARKET_VALUE_CENTS = 30_000_000 // €300k

/** Parse Transfermarkt-style "€18.00m" / "€900k" into cents. Returns the default when absent. */
export function parseMarketValue(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_MARKET_VALUE_CENTS
  const m = raw.replace(/\s/g, '').match(/€?([\d.]+)\s*([mk]?)/i)
  if (!m) return DEFAULT_MARKET_VALUE_CENTS
  const n = parseFloat(m[1])
  if (!isFinite(n)) return DEFAULT_MARKET_VALUE_CENTS
  const unit = m[2].toLowerCase()
  const euros = unit === 'm' ? n * 1_000_000 : unit === 'k' ? n * 1_000 : n
  return Math.round(euros * 100)
}

/** Season the vendored dataset represents (data/2025 → the 2025/26 campaign). */
export const SEASON_START = new Date('2025-08-01T00:00:00Z')

/** Whole-years age at a reference date. Parses "May 11, 1992". Deterministic. */
export function ageAt(dateOfBirth: string | null | undefined, ref = SEASON_START): number {
  if (!dateOfBirth) return 27 // prime default when DOB is missing
  const dob = new Date(dateOfBirth)
  if (isNaN(dob.getTime())) return 27
  let age = ref.getUTCFullYear() - dob.getUTCFullYear()
  const beforeBirthday =
    ref.getUTCMonth() < dob.getUTCMonth() ||
    (ref.getUTCMonth() === dob.getUTCMonth() && ref.getUTCDate() < dob.getUTCDate())
  if (beforeBirthday) age--
  return age
}
