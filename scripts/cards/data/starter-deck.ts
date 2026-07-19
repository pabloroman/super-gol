// The default deck ("juego básico"): the 55 cards every new account is granted.
// handle_new_user() grants one copy of every card flagged is_starter, so this list
// IS the starter deck. Recreates the original game's 55-card basic set from the
// current-season LaLiga catalog.
//
// Curated for balance: position GK 6 / DF 18 / MF 16 / FW 15, rarity
// comun 36 / frecuente 16 / rara 3, with a spread of cost (3..9) and no more
// than ~3 cards per club. A legal 16-player squad (≤100 pts) is always
// buildable from the grant — the 16 cheapest here total 79.
//
// Consumed offline by both catalog emitters (never by the app or edge function):
//   * build.ts       -> the `update … set is_starter = true` block in seed_cards.sql
//   * export-csv.ts  -> the is_starter column of the admin-import CSV
// so the deck can never drift from the catalog it flags. This is the source of
// truth for the deck; the starter flag itself lives only in the DB.

export const STARTER_IDS: readonly string[] = [
  '398131-2526', // GK c3 comun [val]
  '54217-2526', // GK c5 comun [ala]
  '1055220-2526', // GK c6 comun [rma]
  '284430-2526', // GK c7 comun [ovi]
  '417913-2526', // GK c7 frecuente [bet]
  '124419-2526', // GK c7 frecuente [sev]
  '533354-2526', // DF c4 comun [ala]
  '1268764-2526', // DF c5 comun [get]
  '765467-2526', // DF c5 comun [ray]
  '929899-2526', // DF c5 comun [ovi]
  '559979-2526', // DF c6 comun [get]
  '356197-2526', // DF c6 comun [vil]
  '129444-2526', // DF c6 comun [gir]
  '448628-2526', // DF c6 comun [osa]
  '169497-2526', // DF c6 comun [osa]
  '1144700-2526', // DF c6 comun [lev]
  '495625-2526', // DF c6 comun [elc]
  '591916-2526', // DF c7 frecuente [ath]
  '291417-2526', // DF c7 comun [rma]
  '341264-2526', // DF c7 frecuente [rma]
  '676042-2526', // DF c7 frecuente [sev]
  '985383-2526', // DF c7 frecuente [bet]
  '282411-2526', // DF c8 frecuente [atm]
  '411975-2526', // DF c9 rara [fcb]
  '1063574-2526', // MF c4 comun [mll]
  '268670-2526', // MF c5 comun [ray]
  '142031-2526', // MF c5 comun [mll]
  '465967-2526', // MF c6 comun [ala]
  '394236-2526', // MF c6 comun [val]
  '531404-2526', // MF c6 comun [elc]
  '720038-2526', // MF c6 comun [mll]
  '230784-2526', // MF c6 comun [vil]
  '395234-2526', // MF c7 comun [sev]
  '625047-2526', // MF c7 frecuente [ath]
  '348795-2526', // MF c7 frecuente [bet]
  '502722-2526', // MF c7 comun [rso]
  '636695-2526', // MF c7 frecuente [fcb]
  '646740-2526', // MF c8 frecuente [fcb]
  '711374-2526', // MF c8 frecuente [rso]
  '775605-2526', // MF c9 rara [atm]
  '277533-2526', // FW c4 comun [elc]
  '834744-2526', // FW c5 comun [esp]
  '711382-2526', // FW c5 comun [rso]
  '1063553-2526', // FW c5 comun [vil]
  '560417-2526', // FW c6 comun [ray]
  '59323-2526', // FW c6 comun [gir]
  '895326-2526', // FW c6 comun [gir]
  '905997-2526', // FW c6 comun [cel]
  '1127730-2526', // FW c6 comun [ovi]
  '617081-2526', // FW c7 frecuente [val]
  '72047-2526', // FW c7 comun [cel]
  '1038950-2526', // FW c7 frecuente [lev]
  '764859-2526', // FW c7 frecuente [cel]
  '742201-2526', // FW c8 frecuente [atm]
  '937958-2526', // FW c9 rara [fcb]
]
