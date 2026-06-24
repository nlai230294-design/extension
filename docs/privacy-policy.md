# Chính sách quyền riêng tư — Social Post Analyzer

**Ngày có hiệu lực:** 24.06.2026
**Liên hệ:** nlai230294@gmail.com

> Tài liệu này cần được host ở một URL công khai (ví dụ GitHub Pages, Google Sites) và điền vào
> mục "Privacy policy URL" trên Chrome Web Store Developer Dashboard, đồng thời liên kết tới từ
> phần mô tả extension.

## 1. Giới thiệu

Social Post Analyzer ("Extension") là tiện ích mở rộng Chrome hỗ trợ kiểm duyệt viên (moderator)
đánh giá mức độ an toàn nội dung của các bài đăng hiển thị trong nhóm Facebook, bằng cách phân
tích văn bản qua AI và hiển thị điểm rủi ro tổng hợp. Chính sách này giải thích Extension thu
thập dữ liệu gì, dùng vào việc gì, chia sẻ với ai, và người dùng có quyền gì đối với dữ liệu đó.

## 2. Dữ liệu được thu thập

Extension **chỉ** thu thập dữ liệu khi người dùng chủ động bấm "Bắt đầu" trên một trang nhóm
Facebook (`facebook.com/groups/...`) đang mở, và **chỉ** thu thập nội dung **đang hiển thị công
khai trên màn hình** của người dùng tại thời điểm đó — không đăng nhập hộ, không truy cập tin
nhắn riêng, không thu thập dữ liệu ngoài nhóm Facebook đang được quét.

Cụ thể, với mỗi bài đăng quét được:

| Dữ liệu | Mô tả |
|---|---|
| Nội dung văn bản bài đăng | Toàn bộ nội dung text hiển thị của bài đăng |
| Tên hiển thị & liên kết trang cá nhân của người đăng | Lấy từ thông tin hiển thị công khai trên bài đăng |
| Đường dẫn bài đăng / đường dẫn trang đang quét | URL bài viết và URL trang nhóm tại thời điểm thu thập |
| Thời điểm thu thập | Ngày giờ bài đăng được quét |

Extension **không** thu thập: mật khẩu, cookie đăng nhập Facebook, tin nhắn riêng (Messenger),
bài đăng ở chế độ riêng tư mà người dùng không có quyền xem, hoặc dữ liệu từ các trang web khác
ngoài `facebook.com`.

Ngoài ra, Extension lưu một mục nhỏ trong bộ nhớ cục bộ của trình duyệt (`chrome.storage.local`)
để ghi nhớ phiên làm việc hiện tại (mã phiên, trạng thái chạy/dừng) — dữ liệu này chỉ tồn tại
trên máy người dùng.

## 3. Mục đích sử dụng dữ liệu

Dữ liệu thu thập được dùng **duy nhất** để:

1. Gửi tới hệ thống backend của Extension để lưu trữ và đưa vào phân tích AI.
2. Tính điểm rủi ro nội dung (độ độc hại, spam, thao túng, nguy cơ cực đoan, cảm xúc) cho từng
   bài đăng và tổng hợp theo người đăng.
3. Hiển thị lại kết quả đó cho chính người dùng (kiểm duyệt viên) trong popup của Extension để hỗ
   trợ ra quyết định kiểm duyệt — **con người luôn là người quyết định cuối cùng**, Extension
   không tự động ẩn/xoá/báo cáo/chặn bất kỳ ai.

Dữ liệu **không** được dùng cho quảng cáo, không được bán, không được dùng để xây dựng hồ sơ
(profile) phục vụ mục đích nào khác ngoài mục đích nêu trên.

## 4. Chia sẻ với bên thứ ba

Nội dung văn bản bài đăng được gửi tới nhà cung cấp dịch vụ AI (hiện tại: **OpenAI**, qua API
`api.openai.com`) để thực hiện việc chấm điểm nội dung. OpenAI xử lý dữ liệu này theo
[chính sách của OpenAI](https://openai.com/policies/) và theo cấu hình API hiện hành (dữ liệu gửi
qua API không được OpenAI dùng để huấn luyện mô hình theo chính sách API tiêu chuẩn của họ tại
thời điểm viết tài liệu này — vui lòng kiểm tra chính sách mới nhất của OpenAI).

Ngoài nhà cung cấp AI nói trên, dữ liệu **không** được chia sẻ, bán, hay chuyển giao cho bất kỳ
bên thứ ba nào khác.

## 5. Lưu trữ dữ liệu

Dữ liệu được lưu trên cơ sở dữ liệu (MySQL) do nhà phát triển Extension vận hành, dùng cho mục
đích vận hành tính năng kiểm duyệt nêu trên. Dữ liệu được giữ lại để phục vụ tra cứu lịch sử kiểm
duyệt; người dùng có thể yêu cầu xoá dữ liệu liên quan đến mình theo hướng dẫn ở mục 6.

## 6. Quyền của người dùng

Người dùng có thể:

- **Dừng thu thập bất kỳ lúc nào** bằng nút "Dừng" trong popup.
- **Yêu cầu xoá dữ liệu** đã thu thập liên quan đến mình bằng cách gửi email tới địa chỉ liên hệ
  ở đầu tài liệu này, kèm thông tin đủ để xác định dữ liệu cần xoá (ví dụ link bài viết, tên hiển
  thị).
- **Gỡ Extension** bất kỳ lúc nào qua `chrome://extensions` — dữ liệu lưu cục bộ
  (`chrome.storage.local`) sẽ bị xoá theo Extension; dữ liệu đã gửi lên backend trước đó cần được
  xoá theo yêu cầu ở trên.

## 7. Bảo mật

Dữ liệu được truyền giữa Extension và backend qua kết nối HTTPS. Backend giới hạn truy cập API
theo CORS tới đúng Extension. Không có hệ thống nào an toàn tuyệt đối; nếu phát hiện vấn đề bảo
mật, vui lòng báo cho địa chỉ liên hệ ở đầu tài liệu.

## 8. Đối tượng trẻ em

Extension không hướng tới và không cố ý thu thập dữ liệu từ trẻ em dưới 13 tuổi.

## 9. Thay đổi chính sách

Chính sách này có thể được cập nhật khi Extension thay đổi cách thu thập/xử lý dữ liệu. Phiên bản
mới sẽ được công bố tại cùng URL này kèm ngày cập nhật.

## 10. Liên hệ

Mọi câu hỏi về quyền riêng tư, vui lòng liên hệ: **nlai230294@gmail.com**
