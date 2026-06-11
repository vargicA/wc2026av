CREATE TABLE IF NOT EXISTS public._diag (k text, v text);
INSERT INTO public._diag(k,v) VALUES ('cron_secret_len', (SELECT length(decrypted_secret)::text FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1));
INSERT INTO public._diag(k,v) VALUES ('cron_secret_md5', (SELECT md5(decrypted_secret) FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1));
INSERT INTO public._diag(k,v) VALUES ('cron_secret_count', (SELECT count(*)::text FROM vault.decrypted_secrets WHERE name='CRON_SECRET'));