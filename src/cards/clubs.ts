// Club display name -> short slug. Keeps the slugs already used by the decoded
// originals in supabase/seed.sql (rma, atm, fcb, ath) and assigns stable short
// codes to the rest of the 2025/26 LaLiga clubs.

const CLUB_SLUGS: Record<string, string> = {
  'Real Madrid': 'rma',
  'Atlético de Madrid': 'atm',
  'FC Barcelona': 'fcb',
  'Athletic Club': 'ath',
  'Real Betis Balompié': 'bet',
  'Valencia CF': 'val',
  'Sevilla FC': 'sev',
  'Real Sociedad': 'rso',
  'RCD Espanyol Barcelona': 'esp',
  'Elche CF': 'elc',
  'Real Oviedo': 'ovi',
  'Levante UD': 'lev',
  'RCD Mallorca': 'mll',
  'RC Celta': 'cel',
  'CA Osasuna': 'osa',
  'Villarreal CF': 'vil',
  'Deportivo Alavés': 'ala',
  'Getafe CF': 'get',
  'Rayo Vallecano': 'ray',
  'Girona FC': 'gir',
}

/**
 * Club slug -> Transfermarkt club id, for the crest on the naipe's name band
 * («Escudo del club — arriba a la derecha», rulebook page 2).
 *
 * Ids are lifted from `clubs[].transfermarktId` in the vendored snapshot
 * (scripts/cards/data/laliga-2025.json), which also carries the crest as
 * `clubs[].image` — always exactly the URL `crestUrl` builds below. Kept here
 * rather than in a `cards` column for the same reason `image_url` is baked into
 * the generated migration: the URL is identical on every environment. Re-vendor
 * a season -> refresh this map alongside CLUB_SLUGS.
 */
const CLUB_CREST_IDS: Record<string, string> = {
  ala: '1108', // Deportivo Alavés
  ath: '621', // Athletic Club
  atm: '13', // Atlético de Madrid
  bet: '150', // Real Betis Balompié
  cel: '940', // RC Celta
  elc: '1531', // Elche CF
  esp: '714', // RCD Espanyol Barcelona
  fcb: '131', // FC Barcelona
  get: '3709', // Getafe CF
  gir: '12321', // Girona FC
  lev: '3368', // Levante UD
  mll: '237', // RCD Mallorca
  osa: '331', // CA Osasuna
  ovi: '2497', // Real Oviedo
  ray: '367', // Rayo Vallecano
  rma: '418', // Real Madrid
  rso: '681', // Real Sociedad
  sev: '368', // Sevilla FC
  val: '1049', // Valencia CF
  vil: '1050', // Villarreal CF
}

const CREST_CDN = 'https://tmssl.akamaized.net/images/wappen/big'

/** Crest URL for a club slug, or null for a club we have no id for. */
export function crestUrl(slug: string | null | undefined): string | null {
  if (!slug) return null
  const id = CLUB_CREST_IDS[slug]
  return id ? `${CREST_CDN}/${id}.png` : null
}

export function clubSlug(name: string): string {
  if (CLUB_SLUGS[name]) return CLUB_SLUGS[name]
  // Deterministic fallback: first letters of the significant words, lowercased.
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !/^(cf|fc|rcd|ca|rc|ud|de|club)$/i.test(w))
  const base = (words.join('') || name).toLowerCase()
  return base.slice(0, 3)
}
