-- Seed data (local only — runs on `supabase db reset`, never on production).
--
-- The card catalog and store are owned entirely by migrations, so this file
-- seeds no game data:
--   * cards   — supabase/migrations/0005_cards_laliga_2025.sql (current-season LaLiga)
--   * starter — supabase/migrations/0009_starter_deck.sql (the 55-card "juego básico"
--               flagged is_starter, granted to every new account by handle_new_user)
--   * packs   — supabase/migrations/0008_store_packs.sql
--
-- What it does seed is two dev accounts, because nothing else can create them:
-- a reset drops auth.users, is_admin defaults to false (0006), and the only
-- in-app way to set it — admin_set_admin (0011) — already requires an admin.
-- Without this file every reset means signing up by hand and then flipping the
-- flag in SQL to get back into the Admin screen.
--
--   admin@supergol.test / password123   — is_admin, sees the Admin tab
--   coach@supergol.test / password123   — a plain player, the default experience
--
-- Both start with the 500 coins and the 55-card starter deck that
-- handle_new_user grants, because inserting into auth.users fires the real
-- on_auth_user_created trigger (0003/0012) rather than reproducing its work
-- here. That is the point of seeding at this layer: the seeded accounts are
-- built by the same code path as a live signup, so they cannot drift from it.
--
-- `supabase db reset --linked` (npm run db:reset:linked) runs this file against
-- the LINKED REMOTE, where a public password on an is_admin account would be a
-- real breach. The guard below refuses that, so the danger is documented in code
-- rather than in a comment nobody reads at 2am.
--
-- Fixed UUIDs, so the accounts are stable across resets: rows you reference by
-- hand (a squad you keep re-seeding, a match you're debugging) survive.
do $$
declare
  acct record;
  -- The local stack's JWT secret, hardcoded in the CLI and published in its
  -- docs. Every hosted project generates its own, so this value cannot match a
  -- real database — which makes it a test of the thing that actually matters
  -- here: are the credentials in this file public throwaways, or live secrets?
  local_jwt_secret constant text := 'super-secret-jwt-token-with-at-least-32-characters-long';
begin
  -- Guard, inside the block that does the inserts so a raise cannot be stepped
  -- over. `is distinct from` fails safe: on a stack that doesn't expose the
  -- setting at all, current_setting returns NULL and this still refuses. If a
  -- future CLI drops or changes the setting, local resets start failing with the
  -- message below — noisy, but wrong in the survivable direction.
  if current_setting('app.settings.jwt_secret', true) is distinct from local_jwt_secret then
    raise exception 'seed.sql refused to run: this database is not the local Supabase stack'
      using
        detail = 'This file seeds an is_admin account whose password is published in the '
                 'file itself. It is safe only where every credential is already public.',
        hint   = 'Use `npm run db:reset` (local). If you meant to reset the linked remote, '
                 'it does not want these accounts.';
  end if;

  for acct in
    select *
    from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@supergol.test', 'Admin',       true),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'coach@supergol.test', 'Entrenadora', false)
    ) as t (id, email, username, is_admin)
  loop
    -- The empty strings are deliberate: GoTrue scans these token columns into a
    -- non-nullable Go string and errors on NULL, even though the schema allows it.
    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', acct.id, 'authenticated', 'authenticated',
      acct.email, extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      -- Exactly where the signup form puts the username; handle_new_user reads
      -- it from here, btrims it, and now requires a valid handle (0017). Both
      -- seed names satisfy the format.
      jsonb_build_object('username', acct.username),
      now(), now(),
      '', '', '', ''
    );

    -- Password sign-in needs an identity row too: GoTrue looks the user up by
    -- provider identity, so a user without one exists but cannot log in.
    -- identities.email is generated from identity_data — never insert it.
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      acct.id::text, acct.id,
      jsonb_build_object(
        'sub', acct.id::text,
        'email', acct.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(), now(), now()
    );

    -- After the trigger, not instead of it: the profile already exists by now.
    if acct.is_admin then
      update public.profiles set is_admin = true where id = acct.id;
    end if;
  end loop;
end $$;
