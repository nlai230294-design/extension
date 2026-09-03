-- Dedup TOÀN HỆ THỐNG theo post_hash (profile_url|content): cùng một bài của
-- cùng một người chỉ được lưu 1 lần trên toàn bộ session.
--
-- UNIQUE vừa chặn trùng ngay ở tầng DB (đóng cả khe race khi 2 session ingest
-- đồng thời), vừa đóng vai trò index cho việc kiểm tra trùng lúc ingest — chỉ
-- tốn 1 lần tra index thay vì full scan.
CREATE UNIQUE INDEX `posts_post_hash_key` ON `posts`(`post_hash`);
