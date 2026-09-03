-- Thêm cột lưu chuỗi thời điểm đăng bài do Facebook hiển thị (vd "5 giờ",
-- "13 Tháng 6 lúc 20:15"). Nullable vì bài cũ / bài không lấy được timestamp.
ALTER TABLE `posts` ADD COLUMN `posted_at_text` VARCHAR(255) NULL;
