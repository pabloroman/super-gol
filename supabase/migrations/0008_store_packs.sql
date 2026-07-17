-- Store packs. Moved out of seed.sql (which runs only on local `db reset`) into a
-- migration so the Store works on production too. open_pack() (0003_functions.sql)
-- reads these rows; without them the store is empty and pack purchases fail.

insert into public.packs (id, name, description, price, card_count, rarity_weights, sort_order)
values
  ('sobre-basico', 'Sobre Básico', '6 cartas. Sobre todo comunes, con alguna sorpresa.', 150, 6,
   '{"comun":75,"frecuente":22,"rara":3}', 1),
  ('sobre-oro', 'Sobre Oro', '6 cartas con muchas más opciones de sacar una carta rara.', 400, 6,
   '{"comun":50,"frecuente":35,"rara":15}', 2)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, price = excluded.price,
  card_count = excluded.card_count, rarity_weights = excluded.rarity_weights,
  sort_order = excluded.sort_order;
