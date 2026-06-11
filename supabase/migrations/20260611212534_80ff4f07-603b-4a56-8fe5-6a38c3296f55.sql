DO $$
DECLARE v text;
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1;
  RAISE NOTICE 'vault len=% md5=%', length(v), md5(v);
END $$;