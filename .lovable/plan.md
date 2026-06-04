## League chat feature

Add a real-time group chat to each league so the admin and members can discuss stakes, rules, banter, and anything else in one place. New messages show as an unread badge on the league entry until viewed.

### User experience

- On each league page, add a **Chat** tab (alongside the existing standings/members view).
- Anyone in the league can post messages. Messages show sender name, timestamp, and text. Newest at the bottom, auto-scroll on new message.
- The league creator (admin) gets a small "Admin" tag next to their name and can delete any message; regular members can only delete their own.
- Messages from the admin get a subtle highlight (left border accent) so stake decisions and announcements stand out from chatter.
- On the **Leagues list** and inside a league, show a small numeric badge with the count of unread messages. Badge clears once the user opens the Chat tab.
- Live updates via Supabase Realtime — no refresh needed.

### Technical details

**New tables**

- `league_messages` — `id`, `league_id`, `user_id`, `body` (text, max 2000 chars), `created_at`.
  - RLS: members of the league can SELECT and INSERT (own user_id only); senders can DELETE own message; league creator can DELETE any message in their league.
- `league_message_reads` — `league_id`, `user_id`, `last_read_at` (composite PK on league_id+user_id).
  - RLS: users can SELECT/INSERT/UPDATE only their own row.
  - Used to compute unread counts: `count(messages where created_at > last_read_at)`.

**Realtime**

- Add `league_messages` to `supabase_realtime` publication.
- Subscribe on the Chat tab filtered by `league_id`, invalidate the messages query on insert/delete.
- Subscribe on the leagues list too (filtered to the user's league_ids) so unread badges update live.

**Server functions** (`src/lib/league-chat.functions.ts`, protected by `requireSupabaseAuth`)

- `sendLeagueMessage({ league_id, body })` — validates membership, inserts message.
- `deleteLeagueMessage({ message_id })` — relies on RLS for permission.
- `markLeagueRead({ league_id })` — upserts `last_read_at = now()` for current user.
- `getLeagueUnreadCounts()` — returns `{ league_id, unread }[]` for the current user's leagues, used by the leagues list.

**UI**

- New `src/routes/_authenticated.leagues.$leagueId.chat.tsx` (or a tab inside the existing league route — recommend the tab so context stays).
- Components: `LeagueChat` (message list + composer), `MessageBubble`, `UnreadBadge`.
- Composer is a single-line textarea + Send button; Enter sends, Shift+Enter newlines.
- Use `useSuspenseQuery` for message history; realtime channel updates the same query key.

### Out of scope (can be added later)

- Pinned messages, polls/votes on stake amount, file attachments, @mentions, push/email notifications, edit message, typing indicators, reactions.

### Open question

The league page currently lives at `_authenticated.leagues.$leagueId.tsx`. I'd recommend adding the chat as a tab inside that route rather than a separate URL, so the standings stay visible. Confirm that's fine, or say if you want a dedicated `/leagues/:id/chat` route instead.