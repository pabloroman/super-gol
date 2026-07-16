-- Seed data.
-- Ability keys: rb (robo balón), a (anticipación), rc (remate cabeza),
-- d (desmarque), rg (regate), v (velocidad), pc (pase corto),
-- pl (pase largo), pa (pase alto), dl (disparo lejano), rm (remate en el área).
-- Goalkeepers additionally carry rf (reflejos) and co (colocación).
-- A missing factor counts as zero in the match engine (rulebook page 6).
-- zone_grid is boolean[6][5]: row 0 = attack (top), row 5 = own goal (bottom).
-- true = the player's demarcación, which the naipe prints in RED — «la zona del
-- jugador en rojo» (rulebook page 2). Green is everywhere else.

-- ---- Real cards decoded from the original photo (ability values approximate) ----
insert into public.cards
  (id, name, full_name, club, club_slug, nationality, birthplace, birth_date, height_cm, weight_kg, position, cost, rarity, is_starter, abilities, zone_grid)
values
  ('simeone-atm', 'SIMEONE', 'Diego Pablo Simeone', 'Atlético de Madrid', 'atm', 'Argentina', 'Buenos Aires', '1970-04-28', 180, 77, 'MF', 10, 'rara', true,
   '{"rb":3,"a":1,"rc":3,"d":1,"rg":1,"v":1,"pc":2,"pl":1,"pa":2,"dl":1,"rm":1}',
   '[[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false]]'),

  ('raul-rma', 'RAUL', 'Raúl González Blanco', 'Real Madrid', 'rma', 'España', 'Madrid', '1977-06-27', 180, 66, 'FW', 9, 'rara', true,
   '{"rb":1,"a":1,"rc":2,"d":3,"rg":1,"v":2,"pc":3,"pl":1,"pa":2,"dl":2,"rm":3}',
   '[[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false]]'),

  ('penev-atm', 'PENEV', 'Lyuboslav Mladenov Penev', 'Atlético de Madrid', 'atm', 'Bulgaria', 'Sofia', '1966-08-31', 188, 83, 'FW', 9, 'frecuente', true,
   '{"rb":1,"a":1,"rc":1,"d":1,"rg":1,"v":1,"pc":2,"pl":1,"pa":2,"dl":2,"rm":2}',
   '[[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false]]'),

  ('lakabeg-ath', 'LAKABEG', 'Andoni Lakabeg Fraile', 'Athletic Club', 'ath', 'España', 'Bilbao (Vizcaya)', '1969-02-14', 173, 63, 'MF', 5, 'comun', true,
   '{"rb":2,"a":1,"rc":1,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":2,"dl":1,"rm":1}',
   '[[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false]]'),

  ('paqui-zar', 'PAQUI', 'Francisco Veza Fragoso', 'Real Zaragoza', 'zar', 'España', 'Alicante', '1970-12-06', 179, 78, 'DF', 5, 'comun', true,
   '{"rb":2,"a":2,"rc":1,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":2,"dl":1,"rm":1}',
   '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false]]'),

  ('avelino-spo', 'AVELINO', 'Avelino Riopedre Muiña', 'Sporting de Gijón', 'spo', 'España', 'Gijón (Asturias)', '1971-11-11', 178, 78, 'DF', 5, 'comun', true,
   '{"rb":1,"a":1,"rc":2,"d":1,"rg":1,"v":1,"pc":2,"pl":1,"pa":1,"dl":1,"rm":1}',
   '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false]]'),

  ('busquets-fcb', 'BUSQUETS', 'Carles Busquets Barroso', 'FC Barcelona', 'fcb', 'España', 'Barcelona', '1967-07-19', 181, 80, 'GK', 1, 'comun', true,
   '{"rb":1,"a":1,"rc":1,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":1,"dl":1,"rf":2,"co":2}',
   '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,true,false,false]]');

-- ---- Placeholder base players (fillers) so a new account can field a legal
-- ---- 16-player squad before the real 55-card "juego básico" is digitised.
-- ---- Remove these once the real basic set is entered.
insert into public.cards (id, name, full_name, club, position, cost, rarity, is_starter, abilities, zone_grid)
values
  ('base-gk-1', 'MOLINA',  'Portero base', 'Base', 'GK', 2, 'comun', true, '{"rb":1,"a":2,"rc":1,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":1,"dl":1,"rf":2,"co":2}', '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,true,false,false]]'),
  ('base-df-1', 'GÓMEZ',   'Defensa base', 'Base', 'DF', 4, 'comun', true, '{"rb":2,"a":2,"rc":1,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":1,"dl":1,"rm":1}', '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false]]'),
  ('base-df-2', 'RUIZ',    'Defensa base', 'Base', 'DF', 4, 'comun', true, '{"rb":2,"a":2,"rc":1,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":1,"dl":1,"rm":1}', '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false]]'),
  ('base-df-3', 'TORRES',  'Defensa base', 'Base', 'DF', 4, 'comun', true, '{"rb":2,"a":2,"rc":2,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":1,"dl":1,"rm":1}', '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false]]'),
  ('base-df-4', 'SÁEZ',    'Defensa base', 'Base', 'DF', 4, 'comun', true, '{"rb":2,"a":2,"rc":1,"d":1,"rg":1,"v":1,"pc":1,"pl":1,"pa":1,"dl":1,"rm":1}', '[[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false]]'),
  ('base-mf-1', 'NAVARRO', 'Medio base',   'Base', 'MF', 4, 'comun', true, '{"rb":1,"a":1,"rc":1,"d":1,"rg":2,"v":1,"pc":2,"pl":1,"pa":1,"dl":1,"rm":1}', '[[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false]]'),
  ('base-mf-2', 'CASTRO',  'Medio base',   'Base', 'MF', 4, 'comun', true, '{"rb":1,"a":1,"rc":1,"d":1,"rg":2,"v":1,"pc":2,"pl":1,"pa":1,"dl":1,"rm":1}', '[[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false]]'),
  ('base-mf-3', 'BLANCO',  'Medio base',   'Base', 'MF', 5, 'comun', true, '{"rb":1,"a":1,"rc":1,"d":1,"rg":2,"v":2,"pc":2,"pl":1,"pa":1,"dl":2,"rm":2}', '[[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false]]'),
  ('base-mf-4', 'IGLESIAS','Medio base',   'Base', 'MF', 4, 'comun', true, '{"rb":1,"a":1,"rc":1,"d":1,"rg":2,"v":1,"pc":2,"pl":1,"pa":1,"dl":1,"rm":1}', '[[false,false,false,false,false],[false,true,true,true,false],[true,true,true,true,true],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false]]'),
  ('base-fw-1', 'DÍAZ',    'Delantero base','Base', 'FW', 5, 'comun', true, '{"rb":1,"a":1,"rc":2,"d":2,"rg":1,"v":2,"pc":1,"pl":1,"pa":1,"dl":2,"rm":2}', '[[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false]]'),
  ('base-fw-2', 'MORENO',  'Delantero base','Base', 'FW', 5, 'comun', true, '{"rb":1,"a":1,"rc":2,"d":2,"rg":1,"v":2,"pc":1,"pl":1,"pa":1,"dl":2,"rm":2}', '[[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false]]'),
  ('base-fw-3', 'ROMERO',  'Delantero base','Base', 'FW', 4, 'comun', true, '{"rb":1,"a":1,"rc":2,"d":2,"rg":1,"v":1,"pc":1,"pl":1,"pa":1,"dl":1,"rm":2}', '[[false,true,true,true,false],[true,true,true,true,true],[false,true,true,true,false],[false,false,false,false,false],[false,false,false,false,false],[false,false,false,false,false]]');

-- ---- Store packs ----
insert into public.packs (id, name, description, price, card_count, rarity_weights, sort_order)
values
  ('sobre-basico', 'Sobre Básico', '6 cartas. Sobre todo comunes, con alguna sorpresa.', 150, 6,
   '{"comun":75,"frecuente":22,"rara":3}', 1),
  ('sobre-oro', 'Sobre Oro', '6 cartas con muchas más opciones de sacar una carta rara.', 400, 6,
   '{"comun":50,"frecuente":35,"rara":15}', 2);
