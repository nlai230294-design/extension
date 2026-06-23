# Nội dung gian hàng Chrome Web Store — Social Post Analyzer

Tài liệu này tập hợp toàn bộ nội dung văn bản cần điền khi tạo listing trên
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Chỉ cần
copy-paste vào từng field tương ứng.

## Single purpose (mục đích duy nhất)

Chrome yêu cầu khai báo "single purpose" — một câu mô tả đúng một mục đích duy nhất của extension:

> Hỗ trợ kiểm duyệt viên đánh giá mức độ an toàn nội dung (độc hại, spam, thao túng, nguy cơ cực
> đoan) của các bài đăng hiển thị trong nhóm Facebook mà người dùng đang xem, bằng cách phân tích
> nội dung qua AI và hiển thị điểm rủi ro tổng hợp theo từng người đăng.

## Summary (tối đa 132 ký tự)

Tiếng Việt (130 ký tự):
> Phân tích AI mức độ độc hại, spam, thao túng, nguy cơ cực đoan của bài đăng trong nhóm Facebook — hỗ trợ kiểm duyệt viên, chỉ mang tính tham khảo.

English (125 chars):
> AI-assisted content-safety scoring (toxicity, spam, manipulation, extremism risk) for Facebook group posts — a moderator aid, not a verdict.

## Detailed description

```
Social Post Analyzer là công cụ hỗ trợ kiểm duyệt viên (moderator) của nhóm Facebook đánh giá
nhanh mức độ an toàn nội dung của các bài đăng đang hiển thị trên trang.

CÁCH HOẠT ĐỘNG
• Khi bạn đang mở một nhóm Facebook và bấm "Bắt đầu", extension quét nội dung văn bản của các
  bài đăng ĐANG HIỂN THỊ trên trang (không truy cập bài viết riêng tư, không đăng nhập hộ, không
  thu thập gì ngoài những gì chính bạn đang nhìn thấy trên màn hình).
• Nội dung được gửi tới hệ thống backend của extension để phân tích bằng AI theo 5 chỉ số: mức độ
  độc hại (toxicity), spam, thao túng/lừa dối (manipulation), nguy cơ kích động cực đoan
  (extremism risk) và cảm xúc tổng thể (sentiment).
• Kết quả được tổng hợp theo từng người đăng và hiển thị trực tiếp trong popup của extension,
  kèm bộ lọc theo mức độ rủi ro (thấp/trung bình/cao).

DÀNH CHO AI
Dành cho kiểm duyệt viên, quản trị viên nhóm/cộng đồng cần một công cụ hỗ trợ sàng lọc nội dung
nhanh trước khi quyết định xử lý.

QUAN TRỌNG — GIỚI HẠN CỦA KẾT QUẢ AI
Điểm số AI CHỈ mang tính chất tham khảo về đặc điểm của NỘI DUNG văn bản, KHÔNG phải là kết luận
quy chụp về một cá nhân (ví dụ không kết luận một người "phản động", "xấu", v.v.). Mọi cảnh báo
rủi ro đều cần được con người (kiểm duyệt viên) xem xét lại trước khi đưa ra bất kỳ quyết định
nào. Extension không tự động ẩn, xoá, chặn hay báo cáo bài viết/người dùng nào.

QUYỀN TRUY CẬP EXTENSION YÊU CẦU
• Đọc nội dung trang Facebook đang mở (chỉ trong group bạn truy cập) để quét bài đăng hiển thị.
• Lưu trạng thái phiên làm việc hiện tại trên máy bạn (storage).
• Gửi dữ liệu đã quét tới backend của extension để phân tích AI.

Extension không thu thập mật khẩu, không truy cập tin nhắn riêng, không hoạt động ngoài phạm vi
nhóm Facebook bạn đang mở.

Xem chính sách quyền riêng tư đầy đủ tại: <ĐIỀN URL PRIVACY POLICY ĐÃ HOST>
```

## Category

Đề xuất: **Productivity** (hoặc **Communication**, tuỳ danh mục hiện có trên Dashboard lúc bạn submit).

## Permission justification (Dashboard sẽ hỏi lý do cho từng quyền)

| Quyền | Lý do (điền vào ô justification) |
|---|---|
| `activeTab` | Cần biết tab Facebook đang active để xác định đúng nhóm đang quét và gửi lệnh bắt đầu/dừng tới content script của đúng tab đó. |
| `scripting` | Dùng để tiêm content script vào tab Facebook trong trường hợp content script khai báo tĩnh chưa được nạp (ví dụ tab đã mở từ trước khi cài/ cập nhật extension). |
| `storage` | Lưu trạng thái phiên thu thập hiện tại (session id, trạng thái chạy/dừng) trên máy người dùng để khôi phục khi mở lại popup. |
| Host permission `https://*.facebook.com/*` | Content script cần đọc nội dung bài đăng đang hiển thị trong nhóm Facebook để trích xuất văn bản phân tích. |
| Host permission backend (`https://api.your-domain.com/*`) | Extension cần gửi dữ liệu đã quét tới backend riêng của nhà phát triển để lưu trữ và gọi AI phân tích, sau đó lấy kết quả trả về hiển thị trong popup. |

## Tài sản hình ảnh cần chuẩn bị (chưa có trong repo)

Chrome Web Store yêu cầu hình ảnh thật (không thể tạo bằng code), bạn cần tự thiết kế:

- **Icon Store**: 128×128 PNG (đã có placeholder kỹ thuật tại `extension/public/icons/icon-128.png` — **nên thay bằng logo thật**).
- **Ít nhất 1 ảnh chụp màn hình**: 1280×800 hoặc 640×400 PNG/JPEG (chụp popup đang hiển thị kết quả).
- **Small promo tile** (tùy chọn nhưng nên có): 440×300 PNG.

## Việc cần làm trước khi nộp

1. Thay `extension/production.config.js` → `PRODUCTION_BACKEND_ORIGIN` bằng domain HTTPS thật sau khi deploy backend, và cùng giá trị đó trong `extension/manifest.json` (`host_permissions`).
2. Thay icon placeholder (`extension/public/icons/`) bằng logo thiết kế thật.
3. Build bản publish: `npm run build:production` (xem [extension/README.md](../extension/README.md)), đóng gói thư mục `dist/` thành `.zip` để upload.
4. Host `docs/privacy-policy.md` ở một URL công khai (GitHub Pages / Google Sites...) và điền URL đó vào Dashboard + vào chỗ `<ĐIỀN URL PRIVACY POLICY ĐÃ HOST>` ở trên.
