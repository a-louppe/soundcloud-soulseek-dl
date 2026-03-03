ALTER TABLE tracks ADD COLUMN soundcloud_title TEXT;
UPDATE tracks SET soundcloud_title = title WHERE soundcloud_title IS NULL;
