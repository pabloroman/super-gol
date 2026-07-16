-- Explicit table grants for the client roles.
--
-- 0002 enables RLS and writes the read policies, but a policy is only consulted
-- *after* the table-level privilege check passes — so without a GRANT the client
-- gets "42501 permission denied" and the policies never run. Nothing granted
-- these privileges before: the schema relied on Supabase's implicit default
-- privileges, which differ by the role that creates the table. Tables here are
-- owned by `postgres`, whose defaults in `public` hand anon/authenticated only
-- Dxtm (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) — no SELECT. Tables created by
-- `supabase_admin` get the full arwdDxtm instead, which is why an environment
-- provisioned differently can appear to work while a fresh `db reset` does not.
--
-- Granting explicitly makes the intent part of the schema rather than an
-- artifact of who ran the migration. GRANT is idempotent, so this is a no-op
-- where the privilege already exists.
--
-- SELECT only, and no anon/authenticated write grants: every write that touches
-- the economy or game state goes through a SECURITY DEFINER RPC (0003/0004/0006)
-- which bypasses RLS as owner. That posture is unchanged here.

-- Public catalog: readable by anyone, incl. signed-out visitors ("cards are
-- public" / "packs are public" in 0002).
grant select on public.cards to anon, authenticated;
grant select on public.packs to anon, authenticated;

-- Own-data tables: signed-in only. The 0002 policies already restrict rows to
-- auth.uid(); withholding the grant from anon means a future policy mistake
-- still cannot expose these to a signed-out caller.
grant select on public.profiles     to authenticated;
grant select on public.user_cards   to authenticated;
grant select on public.squads       to authenticated;
grant select on public.squad_slots  to authenticated;
grant select on public.matches      to authenticated;
grant select on public.transactions to authenticated;
