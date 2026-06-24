# Nội dung gian hàng Chrome Web Store — Social Post Analyzer

Bố cục tài liệu này theo đúng dàn ý Chrome gợi ý tại
[developer.chrome.com/docs/webstore/best-listing](https://developer.chrome.com/docs/webstore/best-listing):
Title → Summary → Description → Icon → Screenshots → Promotional images → Additional fields.
Phần phụ lục ở cuối (single purpose, permission justification, checklist) là các trường khác mà
Developer Dashboard yêu cầu khi submit, không thuộc trang best-listing nhưng vẫn cần điền.

## 1. Item Title

```
Social Post Analyzer
```

Ngắn, không nhồi từ khóa, không cần đổi — tên đã mô tả đúng chức năng cốt lõi (phân tích bài
đăng) và không trùng với extension phổ biến nào khác.

## 2. Item Summary (tối đa 132 ký tự)

Đây là dòng hiển thị ở trang chủ/danh mục/kết quả tìm kiếm — nêu bật tính năng + đối tượng dùng,
không dùng từ ngữ cường điệu ("tốt nhất", "nhanh nhất") hay so sánh với extension khác.

Tiếng Việt (121 ký tự):
> Phân tích AI mức độ độc hại, spam, thao túng của bài đăng nhóm Facebook, hỗ trợ kiểm duyệt viên. Chỉ mang tính tham khảo.

English (119 chars):
> AI scoring of toxicity, spam, manipulation and extremism risk in Facebook group posts — a moderator aid, not a verdict.

## 3. Item Description

Theo gợi ý của Chrome: **một đoạn tổng quan**, theo sau là **danh sách ngắn các tính năng chính**.
Tránh nhồi từ khóa lặp lại nhiều lần (item có thể bị tạm dừng nếu lạm dụng) — bản dưới chỉ nêu
mỗi tính năng một lần.

```
Social Post Analyzer hỗ trợ kiểm duyệt viên (moderator) nhóm Facebook đánh giá nhanh mức độ an
toàn nội dung của các bài đăng đang hiển thị trên trang, bằng cách phân tích văn bản qua AI và
hiển thị điểm rủi ro tổng hợp theo từng người đăng — giúp sàng lọc nội dung cần chú ý trước khi
kiểm duyệt viên tự xem xét và quyết định.

Tính năng chính:
• Quét nội dung bài đăng đang hiển thị trong một nhóm Facebook khi bạn bấm "Bắt đầu".
• Chấm điểm AI theo 5 chỉ số: mức độ độc hại, spam, thao túng/lừa dối, nguy cơ kích động cực
  đoan, và cảm xúc tổng thể của nội dung.
• Tổng hợp điểm rủi ro theo từng người đăng, có bộ lọc theo mức độ thấp/trung bình/cao.
• Hiển thị kết quả ngay trong popup, cập nhật liên tục trong lúc quét.

Lưu ý quan trọng: điểm số AI chỉ mang tính tham khảo về đặc điểm của NỘI DUNG văn bản, không phải
kết luận quy chụp về một cá nhân. Mọi cảnh báo rủi ro đều cần kiểm duyệt viên (con người) xem xét
lại trước khi quyết định — extension không tự động ẩn, xoá, chặn hay báo cáo ai cả.

Extension chỉ đọc nội dung đang hiển thị công khai trên trang bạn đang xem, không đăng nhập hộ,
không truy cập tin nhắn riêng. Xem chi tiết tại chính sách quyền riêng tư:
<ĐIỀN URL PRIVACY POLICY ĐÃ HOST>
```

## 4. Store Icon

Dùng `extension/public/icons/icon-128.png`. Theo best practice của Chrome:
- Đơn giản, dễ nhận ra ở kích thước nhỏ (không nhồi chi tiết nhỏ/chữ khó đọc).
- **Không** chèn ảnh chụp màn hình hay phần tử UI vào icon.
- Nhất quán màu/branding với screenshot và promo image bên dưới.

## 5. Screenshots

- **Bắt buộc tối thiểu 1 ảnh, tối đa 5 ảnh.**
- Kích thước: **1280×800** hoặc **640×400**, góc vuông, full-bleed (không viền/padding).
- Phải là ảnh thật của extension đang chạy (không mờ/méo/pixelated), đúng chiều, đúng với bản mới
  nhất đã nộp.

Gợi ý chụp (chưa có, bạn cần tự chụp):
1. Popup lúc đang hiển thị bảng điểm rủi ro theo người dùng (tab "Session hiện tại").
2. Popup lúc lọc theo mức độ rủi ro (Thấp/Trung bình/Cao).
3. (Tuỳ chọn) Trang Facebook group với bài đăng được highlight theo risk_level.

## 6. Promotional images (tuỳ chọn nhưng nên có)

| Loại | Kích thước | Hiển thị |
|---|---|---|
| Small promo tile | 440×280 | Trang chủ, danh mục, kết quả tìm kiếm |
| Marquee image | 1400×560 | Chỉ dùng nếu được Chrome chọn featured trên trang chủ |

Best practice: lấp đầy toàn bộ vùng ảnh, ít chữ, màu bão hòa (tránh nền trắng/xám nhạt lớn), nhìn
vẫn rõ khi thu nhỏ 50%, không ghi các khẳng định không có thật (ví dụ "Editor's Choice").

## 7. Additional fields

- **Website URL**: link repo hoặc trang giới thiệu sản phẩm (nếu có) — giúp tăng độ tin cậy với
  người dùng.
- **Support URL / email**: `nlai230294@gmail.com` (dùng làm kênh nhận yêu cầu hỗ trợ + xoá dữ
  liệu, đã khai báo trong Privacy Policy).

---

## Phụ lục — các trường khác Developer Dashboard yêu cầu khi submit

### Single purpose

> Hỗ trợ kiểm duyệt viên đánh giá mức độ an toàn nội dung (độc hại, spam, thao túng, nguy cơ cực
> đoan) của các bài đăng hiển thị trong nhóm Facebook mà người dùng đang xem, bằng cách phân tích
> nội dung qua AI và hiển thị điểm rủi ro tổng hợp theo từng người đăng.

### Category

Đề xuất: **Productivity** (hoặc **Communication**, tuỳ danh mục hiện có lúc submit).

### Permission justification

| Quyền | Lý do (điền vào ô justification) |
|---|---|
| `activeTab` | Cần biết tab Facebook đang active để xác định đúng nhóm đang quét và gửi lệnh bắt đầu/dừng tới content script của đúng tab đó. |
| `scripting` | Dùng để tiêm content script vào tab Facebook trong trường hợp content script khai báo tĩnh chưa được nạp (ví dụ tab đã mở từ trước khi cài/cập nhật extension). |
| `storage` | Lưu trạng thái phiên thu thập hiện tại (session id, trạng thái chạy/dừng) trên máy người dùng để khôi phục khi mở lại popup. |
| Host permission `https://*.facebook.com/*` | Content script cần đọc nội dung bài đăng đang hiển thị trong nhóm Facebook để trích xuất văn bản phân tích. |
| Host permission backend (`https://extension-fb.xyz/*`) | Extension cần gửi dữ liệu đã quét tới backend riêng của nhà phát triển để lưu trữ và gọi AI phân tích, sau đó lấy kết quả trả về hiển thị trong popup. |

### Privacy practices tab

Tick các mục khai báo dữ liệu thu thập khớp với [docs/privacy-policy.md](privacy-policy.md):
**Personally identifiable info** (tên hiển thị, link profile người đăng) và **Website content**
(nội dung văn bản bài đăng). Dán URL Privacy Policy đã host công khai.

### Checklist trước khi nộp

- [ ] Thay icon placeholder bằng logo thật (nếu chưa).
- [ ] Chụp đủ screenshot (mục 5).
- [ ] Host `docs/privacy-policy.md` ở URL công khai, điền vào mục 3 và Privacy practices tab.
- [ ] Build bản publish: `cd extension && npm run build:production`, nén `dist/` thành `.zip`.
- [ ] Domain backend (`extension-fb.xyz`) đã online, đã test `curl https://extension-fb.xyz/api/health`.
