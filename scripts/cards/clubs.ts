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
