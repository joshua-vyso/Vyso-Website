-- ────────────────────────────────────────────────────────────────────────────
-- DEV ONLY — re-run onboarding for an EXISTING account (no new email needed).
--
-- Onboarding shows whenever an org's `onboarding_completed_at IS NULL`. These
-- snippets reset that so you can walk the flow again with an account you already
-- have. Paste into the Supabase SQL editor. Change the email on each line.
--
-- ⚠️  Use a THROWAWAY/TEST account, never a real client org (Vyso, Turn 'n Slice,
--     Morco, DD Fruits & Veg…). Stage 2 rewrites that org's `locked_modules` and
--     Stage 3 writes uploaded customers/products/documents INTO that org.
-- ────────────────────────────────────────────────────────────────────────────

-- Set the account you're testing with once, here:
--   (must be an already-verified auth user whose password you know)
\set test_email 'josh+test1@vyso.co.za'


-- ── Option A ── Re-enter onboarding, KEEP the existing org ────────────────────
-- Tests the whole UI + RPCs. Stage 1 finds the existing org (idempotent), Stage 2
-- re-locks modules, Stage 3 imports into it. Best for repeat UI testing.
update organisations o
set onboarding_completed_at = null,
    onboarding_stage        = 'profile',
    trial_started_at        = now(),
    trial_ends_at           = now() + interval '14 days',
    locked_modules          = array['procurepulse','pricepilot','marginview',
                                    'wastelog','shiftboard','suppliers',
                                    'reportgen','orderflow']   -- all but docu, until Stage 2
from profiles p
where p.org_id = o.id
  and p.id = (select id from auth.users where email = :'test_email');


-- ── Option B ── Fully fresh: test the org-CREATION path from scratch ──────────
-- Detaches the profile from its org so Stage 1 actually creates a brand-new org.
-- (Leaves the old org orphaned — fine for a throwaway account.) Run INSTEAD of A.
--
-- update profiles set org_id = null
-- where id = (select id from auth.users where email = :'test_email');


-- ── Helper ── Mark a half-created test account's email confirmed ──────────────
-- If a test signup never got verified, this lets you log in with just the
-- password (skips needing the code). Harmless if already confirmed.
--
-- update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
-- where email = :'test_email';


-- After running: go to /app (or /login → sign in). You'll be redirected into
-- /onboarding at Stage 1. No verification email involved.
