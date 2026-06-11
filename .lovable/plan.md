## Verify CRON_SECRET fix

1. Trigger a one-off manual call to `/api/public/sync-worldcup` using the new `CRON_SECRET` to confirm authentication succeeds.
2. Check the response and the `matches` table to confirm the finished Mexico–South Africa fixture now has scores and `status = 'finished'`.
3. Inspect `cron.job_run_details` for the most recent `wc-sync-results-15m` runs to confirm they return 200 instead of 401.
4. If all green, no code changes required — done. If the manual call still 401s, re-check that the vault secret and project env var match exactly (no whitespace/newline).

No file edits are expected unless step 4 reveals a mismatch.