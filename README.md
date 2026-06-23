# Social Comment Analyzer

Chrome Extension (Manifest V3) + backend Node.js để quét các bình luận **hiển thị** trong một
nhóm Facebook và chấm điểm các **chỉ số an toàn nội dung**: toxicity, spam, manipulation,
extremism-risk, sentiment.

> **Lưu ý quan trọng**: Kết quả AI (toxicity/spam/manipulation/extremism_risk/sentiment) chỉ là
> **chỉ số tham khảo về nội dung**, **không phải** là kết luận rằng một cá nhân "phản động" hay
> tương tự. Mọi cảnh báo/xử lý đều cần được **kiểm duyệt viên (con người) xem xét lại**.

## Cấu trúc dự án

```
project-root/
├── backend/     Node.js + Express + Prisma (MySQL) + BullMQ (Redis)
└── extension/   Chrome Extension - Manifest V3, Vite + React (JavaScript, không TypeScript)
```

## Trạng thái: Giai đoạn 1 + 2 (trừ AI thật & đóng gói)

Đã triển khai:
- Backend: schema MySQL (Prisma) cho `sessions`, `social_users`, `comments`, `comment_analysis`,
  `user_scores`, `analysis_cache`; API tạo/dừng/liệt kê session, nhận batch comment (dedupe theo
  `comment_hash`), trả kết quả tổng hợp theo user.
- Hàng đợi BullMQ + worker xử lý phân tích theo batch, cập nhật điểm rủi ro tổng hợp cho mỗi user.
- Cache chi phí AI theo `content_hash`: nếu nội dung comment đã được phân tích trước đó (bởi bất
  kỳ user/session nào), worker dùng lại kết quả trong `analysis_cache` thay vì gọi AI lại.
- AI service ở chế độ **mock** (`AI_PROVIDER=mock`) - sinh điểm số giả lập deterministic theo nội
  dung comment, đúng format để cắm AI thật vào sau.
- Extension: popup React (Bắt đầu/Dừng, thống kê phiên, bảng điểm rủi ro theo user, lọc theo mức
  độ), content script quét comment hiển thị trong viewport theo chu kỳ kèm auto-scroll +
  `MutationObserver` để thu thập real-time toàn bộ trang, highlight trực tiếp trên trang Facebook
  theo `risk_level`, background service worker làm gateway gọi backend (tránh CSP của Facebook).
- Dashboard API cho moderator: `GET /api/sessions`, `GET /api/users`, `GET /api/users/:user_id`
  (chỉ API, chưa có UI riêng).

Chưa triển khai:
- UI dashboard cho moderator.
- Deploy backend lên domain HTTPS thật (hiện vẫn chạy `localhost:3000`) - cần xong trước khi nộp
  lên Chrome Web Store, xem mục **Chuẩn bị publish** dưới đây.

## Chuẩn bị publish lên Chrome Web Store

- `extension/manifest.json`: đã set version `1.0.0`, icon (placeholder, **cần thay logo thật** -
  xem `extension/scripts/generate-placeholder-icons.js`), `host_permissions` trỏ tới
  `extension/production.config.js` (`PRODUCTION_BACKEND_ORIGIN`) - **thay domain placeholder bằng
  domain backend thật sau khi deploy**.
- Build bản publish: `cd extension && npm run build:production` (khác với `npm run build` thông
  thường - lệnh đó vẫn trỏ về `localhost:3000` để test dev như cũ). Đóng gói thư mục
  `extension/dist` thành `.zip` để upload.
- Nội dung mô tả/store listing: [docs/store-listing.md](docs/store-listing.md).
- Chính sách quyền riêng tư (cần host ở URL công khai trước khi nộp):
  [docs/privacy-policy.md](docs/privacy-policy.md).

## Yêu cầu hệ thống

- Node.js 18+ và npm
- Docker Desktop (chạy MySQL + Redis) - trên Windows cần WSL2
- Google Chrome

## 1. Chạy MySQL + Redis (Docker)

```bash
docker run --name social-analyzer-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=social_analyzer -p 3306:3306 -d mysql:8
docker run --name social-analyzer-redis -p 6379:6379 -d redis:7
```

## 2. Backend

```bash
cd backend
npm install            # đã cài sẵn trong repo này
npx prisma migrate dev --name init
npm run dev
```

- `.env` được copy sẵn từ `.env.example` (xem lại `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN` nếu
  cần đổi).
- `GET http://localhost:3000/api/health` → `{"status":"ok"}` (không cần DB/Redis để trả lời).
- Các endpoint khác (`/api/sessions`, `/api/analysis/...`) cần MySQL + Redis đang chạy.

### API chính

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/api/sessions` | Tạo session mới, trả `session_id` (uuid) |
| GET | `/api/sessions` | Danh sách session (phân trang `limit`/`offset`), kèm tổng số comment/user |
| POST | `/api/sessions/:session_id/stop` | Dừng session |
| POST | `/api/analysis/batch` | Nhận batch comment, dedupe, enqueue phân tích |
| GET | `/api/analysis/results/:session_id` | Lấy kết quả tổng hợp theo user |
| GET | `/api/users` | Danh sách toàn bộ user đã quét (mọi session), sắp xếp theo `max_overall_risk_score` |
| GET | `/api/users/:user_id` | Chi tiết một user: thông tin + điểm rủi ro theo từng session |
| GET | `/api/health` | Health check |

## 3. Extension

```bash
cd extension
npm install            # đã cài sẵn trong repo này
npm run build
```

Sau đó vào `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và chọn thư mục
`extension/dist`.

Trong quá trình phát triển có thể dùng `npm run dev` (Vite HMR) nhưng vẫn cần **load lại** extension
trong `chrome://extensions` để nhận thay đổi ở `manifest.json`, content script, service worker.

## Luồng sử dụng

1. Mở một nhóm Facebook (`facebook.com/groups/...`) trong Chrome.
2. Click icon extension → **Bắt đầu**: tạo session mới ở backend và yêu cầu content script bắt
   đầu quét.
3. Content script định kỳ quét các comment đang hiển thị trong viewport, đồng thời tự động cuộn
   trang (auto-scroll) và dùng `MutationObserver` để phát hiện comment mới được Facebook tải
   thêm, gửi theo batch (qua background service worker) tới `/api/analysis/batch`.
4. Backend lưu comment (dedupe theo `comment_hash`), đẩy job vào BullMQ; worker kiểm tra
   `analysis_cache` theo `content_hash` - nếu đã có thì dùng lại kết quả, nếu chưa thì gọi AI
   (mock), lưu `comment_analysis` + cache, tính lại `user_scores`.
5. Popup polling `/api/analysis/results/:session_id` định kỳ, hiển thị bảng điểm rủi ro theo user
   (sắp xếp giảm dần theo `overall_risk_score`), có thể lọc theo `risk_level`. Content script cũng
   định kỳ lấy kết quả này để highlight trực tiếp các comment trên trang theo `risk_level`.
6. Click **Dừng** để dừng quét, dừng auto-scroll/observer/highlight, và đóng session.

## Đổi sang AI thật

`AI_PROVIDER` trong `backend/.env` đang là `mock`. Để dùng AI thật:
1. Thêm logic gọi provider (Anthropic/OpenAI...) trong `backend/src/services/ai.service.js` -
   cùng signature `analyzeBatch(items)` và cùng shape kết quả (`toxicity_score`, `spam_score`,
   `manipulation_score`, `extremism_risk_score`, `sentiment_score`, `label`, `explanation`,
   `model_name`).
2. Đặt `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` trong `.env`.

## Giới hạn đã biết

- `extension/src/content/domSelectors.js` chứa các selector "best-effort" cho cấu trúc DOM của
  Facebook (class name của Facebook bị obfuscate và thay đổi thường xuyên) - cần tinh chỉnh khi
  test trên nhóm Facebook thật. Highlight và `getAuthorInfo` cũng phụ thuộc vào các selector này.
- Auto-scroll, `MutationObserver` và highlight chưa được kiểm thử trên một nhóm Facebook thật
  trong môi trường này (không có trình duyệt/Facebook để test trực tiếp) - đã kiểm tra qua build
  thành công + review code theo đúng pattern selector/messaging hiện có.
- Cache AI theo `content_hash` chỉ dùng nội dung text đã `trim()`; nội dung gần giống nhau nhưng
  khác khoảng trắng/dấu câu sẽ không trùng cache.
