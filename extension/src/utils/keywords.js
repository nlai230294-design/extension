// Logic bộ lọc từ khóa dùng chung cho content script (lọc lúc thu thập) và
// trang Detail (lọc lúc hiển thị), để hai nơi luôn khớp cùng một cách.

// Chuẩn hóa để so khớp thật "khoan dung", khớp hành vi lọc ở trang Detail:
//  - Bỏ dấu tiếng Việt (NFD tách dấu tổ hợp rồi loại; đ/Đ -> d) => không phân
//    biệt dấu, nên "ho chi minh" khớp "Hồ Chí Minh".
//  - Gộp mọi khoảng trắng (kể cả non-breaking space   và xuống dòng mà
//    Facebook hay chèn giữa các từ) về 1 dấu cách => cụm nhiều từ vẫn khớp.
//  - Hạ chữ thường => không phân biệt hoa/thường.
export function normalizeForMatch(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// Tách chuỗi người dùng nhập thành danh sách từ khóa: phân tách theo dấu phẩy
// hoặc xuống dòng (giữ nguyên cụm nhiều từ như "hồ chí minh"), bỏ khoảng trắng
// thừa và mục rỗng, đã chuẩn hóa sẵn để so khớp.
export function parseKeywords(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,\n]/)
    .map((k) => normalizeForMatch(k.trim()))
    .filter(Boolean);
}

// Bài hợp lệ khi không có từ khóa nào (lọc tắt) hoặc nội dung chứa ít nhất 1
// trong các từ khóa. `keywords` là mảng đã qua parseKeywords.
export function matchesKeywords(content, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const haystack = normalizeForMatch(content);
  return keywords.some((kw) => haystack.includes(kw));
}
