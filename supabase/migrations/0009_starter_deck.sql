-- Default deck ("juego básico"): the 55 cards every new account is granted.
-- handle_new_user() (0003_functions.sql) grants one copy of every card flagged
-- is_starter, so this migration IS the starter deck. Recreates the original
-- game's 55-card basic set from the current-season LaLiga catalog (0005).
--
-- Curated for balance: position GK 6 / DF 18 / MF 16 / FW 15, rarity
-- comun 36 / frecuente 16 / rara 3, with a spread of cost (3..9) and no more
-- than ~3 cards per club. A legal 16-player squad (≤100 pts) is always
-- buildable from the grant — the 16 cheapest here total 79.
--
-- NOTE: the starter flag lives only in the DB. The Admin CSV round-trip
-- (export-csv.ts / admin_upsert_cards) does not preserve is_starter, so a full
-- catalog re-import would reset it. This migration is the source of truth.

update public.cards set is_starter = true where id in (
  'cristian-rivero-val-2526',  -- GK c3 comun [val]
  'raul-fernandez-ala-2526',  -- GK c5 comun [ala]
  'fran-gonzalez-rma-2526',  -- GK c6 comun [rma]
  'aaron-escandell-ovi-2526',  -- GK c7 comun [ovi]
  'alvaro-valles-bet-2526',  -- GK c7 frecuente [bet]
  'odysseas-vlachodimos-sev-2526',  -- GK c7 frecuente [sev]
  'facundo-garces-ala-2526',  -- DF c4 comun [ala]
  'davinchi-get-2526',  -- DF c5 comun [get]
  'jozhua-vertrouwd-ray-2526',  -- DF c5 comun [ray]
  'rahim-alhassane-ovi-2526',  -- DF c5 comun [ovi]
  'abdel-abqar-get-2526',  -- DF c6 comun [get]
  'alfonso-pedraza-vil-2526',  -- DF c6 comun [vil]
  'david-lopez-gir-2526',  -- DF c6 comun [gir]
  'javi-galan-osa-2526',  -- DF c6 comun [osa]
  'juan-cruz-osa-2526',  -- DF c6 comun [osa]
  'matias-moreno-lev-2526',  -- DF c6 comun [lev]
  'victor-chust-elc-2526',  -- DF c6 comun [elc]
  'aitor-paredes-ath-2526',  -- DF c7 frecuente [ath]
  'ferland-mendy-rma-2526',  -- DF c7 comun [rma]
  'fran-garcia-rma-2526',  -- DF c7 frecuente [rma]
  'juanlu-sanchez-sev-2526',  -- DF c7 frecuente [sev]
  'valentin-gomez-bet-2526',  -- DF c7 frecuente [bet]
  'marcos-llorente-atm-2526',  -- DF c8 frecuente [atm]
  'jules-kounde-fcb-2526',  -- DF c9 rara [fcb]
  'jan-salas-mll-2526',  -- MF c4 comun [mll]
  'gerard-gumbau-ray-2526',  -- MF c5 comun [ray]
  'omar-mascarell-mll-2526',  -- MF c5 comun [mll]
  'ander-guevara-ala-2526',  -- MF c6 comun [ala]
  'filip-ugrinic-val-2526',  -- MF c6 comun [val]
  'marc-aguado-elc-2526',  -- MF c6 comun [elc]
  'pablo-torre-mll-2526',  -- MF c6 comun [mll]
  'thomas-partey-vil-2526',  -- MF c6 comun [vil]
  'batista-mendy-sev-2526',  -- MF c7 comun [sev]
  'benat-prados-ath-2526',  -- MF c7 frecuente [ath]
  'giovani-lo-celso-bet-2526',  -- MF c7 frecuente [bet]
  'luka-sucic-rso-2526',  -- MF c7 comun [rso]
  'marc-casado-fcb-2526',  -- MF c7 frecuente [fcb]
  'gavi-fcb-2526',  -- MF c8 frecuente [fcb]
  'jon-gorrotxategi-rso-2526',  -- MF c8 frecuente [rso]
  'pablo-barrios-atm-2526',  -- MF c9 rara [atm]
  'josan-elc-2526',  -- FW c4 comun [elc]
  'antoniu-roca-esp-2526',  -- FW c5 comun [esp]
  'jon-karrikaburu-rso-2526',  -- FW c5 comun [rso]
  'pau-cabanes-vil-2526',  -- FW c5 comun [vil]
  'alemao-ray-2526',  -- FW c6 comun [ray]
  'cristhian-stuani-gir-2526',  -- FW c6 comun [gir]
  'joel-roca-gir-2526',  -- FW c6 comun [gir]
  'pablo-duran-cel-2526',  -- FW c6 comun [cel]
  'thiago-fernandez-ovi-2526',  -- FW c6 comun [ovi]
  'diego-lopez-val-2526',  -- FW c7 frecuente [val]
  'iago-aspas-cel-2526',  -- FW c7 comun [cel]
  'karl-etta-eyong-lev-2526',  -- FW c7 frecuente [lev]
  'williot-swedberg-cel-2526',  -- FW c7 frecuente [cel]
  'giuliano-simeone-atm-2526',  -- FW c8 frecuente [atm]
  'lamine-yamal-fcb-2526'  -- FW c9 rara [fcb]
);
