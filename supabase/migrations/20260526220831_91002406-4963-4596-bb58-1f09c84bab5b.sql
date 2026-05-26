SELECT net.http_post(
  url := 'https://project--6a2be404-8f61-4f71-aef0-916ff34f495a.lovable.app/api/public/sync-worldcup',
  headers := jsonb_build_object('x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1), 'Content-Type', 'application/json'),
  body := '{}'::jsonb
);