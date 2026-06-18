-- Change post_hash uniqueness from global to per-session so the same post
-- can be collected across multiple sessions without being silently dropped.
ALTER TABLE `posts` DROP INDEX `posts_post_hash_key`;
ALTER TABLE `posts` ADD UNIQUE INDEX `posts_session_id_post_hash_key`(`session_id`, `post_hash`);
