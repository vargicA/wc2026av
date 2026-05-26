
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'wc-sync-fixtures-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6a2be404-8f61-4f71-aef0-916ff34f495a.lovable.app/api/public/sync-worldcup',
    headers := jsonb_build_object('x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'wc-sync-results-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6a2be404-8f61-4f71-aef0-916ff34f495a.lovable.app/api/public/sync-worldcup',
    headers := jsonb_build_object('x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := '{}'::jsonb
  )
  WHERE EXISTS (
    SELECT 1 FROM public.matches
    WHERE kickoff_utc BETWEEN now() - interval '3 hours' AND now() + interval '30 minutes'
  );
  $$
);
