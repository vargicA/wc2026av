# 2026 World Cup Prediction App — Build Plan

A mobile-first prediction game where friends compete in private leagues. Built on TanStack Start + Lovable Cloud (Postgres, Auth, Edge Functions).

## Phase 1 — Foundation

**Lovable Cloud + Auth**
- Enable Cloud (Postgres, Auth, Edge Functions, secrets).
- Email/password auth (per PRD §3). Add `/login`, `/signup`, `/reset-password`, `/auth/callback`.
- `profiles` table linked to `auth.users` (display_name). Trigger to auto-create profile on signup.

**Database schema** (matches PRD §6, with RLS):
- `profiles`, `leagues`, `league_members`, `matches`, `predictions`
- `invite_code`: 6-char base32, unique
- `prediction_lock_utc`: generated column (`kickoff_utc - interval '2 hours'`)
- RLS:
  - `predictions`: user can write only own row, only when `now() < prediction_lock_utc`. Read: own predictions always; others' predictions only when match `status = 'finished'` AND both users share a league.
  - `leagues`/`league_members`: members can read; only creator can remove members.
  - `matches`: public read.
- Indexes on `kickoff_utc`, `(user_id, match_id)`, `league_members(user_id)`.

## Phase 2 — Fixtures & Results Sync

**API key**: request `FOOTBALL_DATA_API_KEY` secret from user.

**Edge functions / TSS server routes under `/api/public/*`** (signed with shared cron secret):
1. `sync-fixtures` — fetches all 104 matches from football-data.org `/competitions/WC/matches`, upserts into `matches`. Runs on deploy + every 6h.
2. `sync-results` — refreshes `status`, scores, pens. Runs every 15 min during dynamic match windows (kickoff−30m to kickoff+3h).
3. On match transition to `finished`, DB trigger calls `score_predictions(match_id)`:
   - Group stage: 90-min score (FT).
   - Knockout: post-ET score; pen winner overrides outcome.
   - Apply 3 / 1 / 0 per PRD §5.

**pg_cron** schedules both syncs hitting the public endpoints with a `CRON_SECRET` header.

**Leaderboard**: SQL view `league_leaderboard(league_id, user_id, points, exact_count, joined_at)` — computed on read, indexed source columns; fine for ≤ ~100 members per league.

## Phase 3 — UI (mobile-first, TanStack routes)

Routes:
- `/` — landing (hero, CTAs, explainer)
- `/login`, `/signup`, `/reset-password`
- `/_authenticated/dashboard` — leagues list, next match w/ countdown, quick-predict
- `/_authenticated/leagues/new`, `/_authenticated/leagues/join`
- `/_authenticated/leagues/$id` — leaderboard, members, invite link, leave
- `/_authenticated/fixtures` — grouped by matchday, filter chips (upcoming/live/finished)
- `/_authenticated/matches/$id` — predict (pre-lock) or result view (post-finish, w/ league members' picks)
- `/_authenticated/profile` — display name, history, total points
- `/invite/$code` — accept invite (auth-gated)

Design (per §9 — clean, sporty, minimal, Letterboxd energy):
- Light neutral background, single bold accent, geometric sans typography (Inter + a display face like Space Grotesk for numbers/scores).
- Tabular figures for scores/standings. Sharp 4px radius. Generous whitespace. Subtle motion on lock countdown.

## Phase 4 — Polish & QA
- Lock-enforcement: server-side reject + greyed UI client-side.
- Display all times in user's local TZ (stored UTC).
- Empty states, loading skeletons, error boundaries on every route w/ loader.
- SEO meta per route; sitemap.

## Technical notes
- Score predictions inside a Postgres function (not Edge) for atomicity — trigger on `matches` UPDATE when status flips to `finished`.
- `predictions` are per-user, not per-league (per PRD note in §6).
- Tie-breaker view: order by points DESC, exact_count DESC, joined_at ASC.

## Open question (PRD §5 edge case)
KO match user predicts a draw, result is 1–1 then pens: I'll implement as **outcome = "draw" is correct** (1 pt) since post-ET score was a draw; pens only decide who advances. Exact-score (3 pts) if predicted score also matches the 1–1. This matches the spirit of "post-ET score determines outcome for scoring."

## What I need from you
1. Confirm the open-question ruling above (or specify alternative).
2. I'll ask for the **football-data.org API key** once Cloud is enabled.
3. Anything to add to the landing page (your name/branding, league name suggestions)? Default: generic "World Cup Predictions 2026."

Once you approve, I'll build it end-to-end in this order: Cloud + schema → auth → fixtures sync (with seed) → predictions + scoring → leagues + leaderboard → polish.