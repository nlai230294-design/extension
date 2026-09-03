# Social Post Analyzer — Tài liệu tổng quan dự án


## 1. Tổng quan và mục tiêu

**Social Post Analyzer (SCA)** là công cụ hỗ trợ kiểm duyệt viên (moderator) của nhóm Facebook
đánh giá mức độ an toàn nội dung của các bài đăng đang hiển thị trên trang, bằng cách:

1. **Thu thập** văn bản bài đăng (chỉ nội dung người dùng tự nhìn thấy, không truy cập dữ liệu riêng tư).
2. **Phân tích** qua mô hình AI để chấm điểm theo 5 chỉ số rủi ro.
3. **Hiển thị** kết quả trong popup extension và highlight trực tiếp lên trang Facebook.
4. **Hỗ trợ nhiều session** đồng thời (nhiều tab Facebook khác nhau chạy song song).

**Đối tượng dùng**: kiểm duyệt viên nhóm Facebook, không phải người dùng cuối thông thường.

**Disclaimer quan trọng**: điểm số AI chỉ mang tính tham khảo về NỘI DUNG, không phải kết luận về
một cá nhân. Mọi quyết định kiểm duyệt cần có con người xem xét lại.

---

## 2. Kiến trúc hệ thống

Hệ thống gồm 2 thành phần chính: **Chrome Extension** (phía client) và **Backend** (server tự
vận hành).

```
┌─────────────────────────────────────────────────────────────────┐
│                        CHROME BROWSER                           │
│                                                                 │
│  ┌─────────────────┐   messages    ┌──────────────────────────┐ │
│  │   POPUP (React) │◄─────────────►│  BACKGROUND SERVICE      │ │
│  │  - ControlPanel │               │  WORKER                  │ │
│  │  - SessionsList │               │  - API gateway           │ │
│  │  - Results View │               │  - Session map storage   │ │
│  └─────────────────┘               │  - Badge counter         │ │
│                                    └────────────┬─────────────┘ │
│  ┌─────────────────────────────────┐            │ axios         │
│  │  CONTENT SCRIPT (per-tab)       │            │ HTTP          │
│  │  - DOM scraping                 │            │               │
│  │  - Auto-scroll                  │            │               │
│  │  - MutationObserver             │            │               │
│  │  - Highlight overlay            │            │               │
│  └──────────────┬──────────────────┘            │               │
└─────────────────┼──────────────────────────────┼───────────────┘
                  │ chrome.runtime.sendMessage    │
                  └──────────────┐               │
                                 ▼               ▼
┌────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                          │
│  Extension-fb.xyz (production) | localhost:3000 (dev)         │
│                                                                │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────────────────┐│
│  │ Express API  │  │  BullMQ   │  │  AI Service              ││
│  │ REST Routes  │─►│  Queue    │─►│  - mock (dev/test)       ││
│  │              │  │  (Redis)  │  │  - openai gpt-4o-mini    ││
│  └──────┬───────┘  └───────────┘  └──────────────────────────┘│
│         │                                                       │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │                   MySQL (Prisma ORM)                     │   │
│  │  sessions | social_users | posts | post_analysis        │   │
│  │  user_scores | analysis_cache                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                         │
                         ▼
            ┌─────────────────────┐
            │  OpenAI API         │
            │  api.openai.com     │
            │  (AI_PROVIDER=openai│
            └─────────────────────┘
```

---

## 3. Chrome Extension (Manifest V3)

**Công nghệ**: Vite + React (JSX, JavaScript không TypeScript), SCSS, @crxjs/vite-plugin.

**Build commands**:
- `npm run build` → mode development → BACKEND_BASE_URL = `http://localhost:3000`
- `npm run build:production` → mode production → BACKEND_BASE_URL = `https://extension-fb.xyz`

**Domain backend production** được quản lý tập trung tại `extension/production.config.js`.

### 3.1 Background Service Worker (`src/background/serviceWorker.js`)

Vai trò: **API gateway** duy nhất — cả content script và popup đều gọi backend qua đây, vì
Facebook's Content Security Policy (CSP) chặn các request thẳng từ content script đến localhost/
domain ngoài.

**Lưu trạng thái đa session** trong `chrome.storage.local` (key: `social_analyzer_sessions`):
```js
// Cấu trúc map theo tabId
{
  "12345": {
    sessionId: "uuid-abc",    // session_uuid từ backend
    status: "running",
    sourceUrl: "https://facebook.com/groups/...",
    startedAt: 1720000000000,  // Date.now()
    acceptedCount: 47           // số bài đã được backend chấp nhận
  },
  "12346": { ... }            // tab khác đang chạy song song
}
```

Sử dụng `chrome.storage.local` thay vì biến module vì MV3 service worker bị **unload sau ~30 giây
idle** — biến module sẽ mất, storage thì không.

**Xử lý tab đóng** (`chrome.tabs.onRemoved`): khi user đóng tab mà chưa bấm Dừng, worker tự gọi
backend `stopSession()` rồi xóa entry khỏi map — tránh session kẹt mãi ở trạng thái `running`.

**Badge** trên icon extension = tổng số bài đã accepted từ tất cả session đang chạy.

**Message types** xử lý (giao tiếp qua `chrome.runtime.onMessage`):

| Message | Hướng | Xử lý |
|---|---|---|
| `CREATE_SESSION` | Popup → BG | Gọi `POST /api/sessions`, lưu entry vào map |
| `STOP_SESSION` | Popup → BG | Gọi `POST /api/sessions/:id/stop`, xóa entry khỏi map |
| `STOP_ALL_SESSIONS` | Popup → BG | Dừng tất cả session, ghi map rỗng atomically (1 lần) |
| `GET_ACTIVE_SESSIONS` | Popup → BG | Trả về toàn bộ map từ storage |
| `GET_RESULTS` | Popup/Content → BG | Gọi `GET /api/analysis/results/:id` |
| `SUBMIT_BATCH` | Content → BG | Gọi `POST /api/analysis/batch`, cập nhật `acceptedCount` |

### 3.2 Content Script (`src/content/`)

Chạy trong context của trang Facebook, mỗi tab có **instance độc lập**. Không tự khởi chạy — chờ
message `START_COLLECTION` từ popup qua background.

**Các module con:**

#### `collector.js` — Thu thập bài đăng từ DOM

```
queryAllPosts()
  └── document.querySelectorAll(POST_CONTAINER_SELECTOR)
  └── filter: chỉ lấy phần tử có [data-ad-rendering-role="profile_name"]
                (loại bỏ comment, chỉ giữ bài đăng gốc)

collectVisiblePosts()
  └── Với mỗi post container đang trong viewport:
      ├── expandSeeMore() — click "Xem thêm" nếu có, đợi 300ms DOM update
      ├── extractText() — lấy nội dung text từ [data-ad-comet-preview="message"]
      ├── getAuthorInfo() — lấy display_name + profile_url từ <h2 a[role="link"]>
      │   └── Xử lý: strip tracking params (/?__cft__...) để url ổn định
      └── container.dataset.scaKey = crypto.randomUUID() (nếu chưa có)
```

DOM selectors dùng nhiều fallback vì Facebook obfuscate class name và thay đổi thường xuyên
(`domSelectors.js`).

#### `content.js` — Điều phối chính

**Biến module-level** (tồn tại suốt lifetime của content script trong tab):
```js
let sessionId = null;       // UUID của session đang chạy
let scanIntervalId = null;
let highlightIntervalId = null;
const seenKeys = new Set(); // DOM key của mọi post đã gửi — chống trùng lặp
```

**`scanAndSubmit()`** — hàm cốt lõi, chạy định kỳ:
1. Gọi `collectVisiblePosts()` → danh sách bài đang hiển thị trong viewport.
2. Lọc bằng `seenKeys`: bài nào đã có `dom_key` trong set → bỏ qua.
3. Bài mới: thêm `dom_key` vào `seenKeys`, push vào `newItems`.
4. Chia `newItems` thành các batch ≤ `BATCH_SIZE = 20`, gửi qua `SUBMIT_BATCH`.

**Lưu ý**: `seenKeys` KHÔNG xóa trong suốt session → không bao giờ gửi lại bài đã gửi, kể cả khi
user scroll lên lại. Session mới → `seenKeys.clear()`.

**`startCollection(sessionId)`**: clear seenKeys, chạy scan ngay lập tức, set interval 5s, bật
observer, bật auto-scroll.

**`stopCollection()`**: clear interval, disconnect observer, stop auto-scroll, clear highlight.

#### `observer.js` — Phát hiện bài mới tải

`MutationObserver` theo dõi `document.body` cho `childList + subtree`. Khi Facebook lazy-load thêm
bài (infinite scroll), observer kích `scanAndSubmit` sau debounce 1s.

#### `autoScroll.js` — Tự động cuộn trang

Cuộn `600px` mỗi `2000ms` để kích Facebook tải thêm nội dung. Tạm dừng `3000ms` khi phát hiện
user tự scroll (sự kiện `wheel`/`touchmove`).

Không có cơ chế dừng khi đạt số bài nhất định — collection "dừng lấy bài mới" tự nhiên khi
auto-scroll đến đáy trang và Facebook không tải thêm DOM node mới.

#### `highlighter.js` — Highlight bài đăng trực tiếp trên trang Facebook

Được gọi định kỳ mỗi `6000ms` (qua `GET_RESULTS`), áp dụng outline màu lên từng bài đăng tùy
theo `risk_level` của tác giả:
- **Xanh** `#16a34a`: rủi ro thấp
- **Cam** `#b45309`: rủi ro trung bình
- **Đỏ** `#dc2626`: rủi ro cao

Cơ chế: inject CSS rule vào `document.head`, gán `data-sca-risk="high|medium|low"` và
`data-sca-risk-label="Rủi ro cao (0.82)"` lên container bài đăng, matching theo `profile_url`
tác giả.

### 3.3 Popup UI (`src/popup/`)

**Công nghệ**: React, SCSS (400px width fixed).

**State chính trong `App.jsx`**:
```js
activeTab          // "session" | "sessions" | "all" — tab UI đang chọn
currentTabId       // string — tabId của Chrome tab đang active khi mở popup
viewingTabId       // string — session nào đang được hiển thị kết quả
runningSessions    // { [tabId]: { sessionId, sourceUrl, acceptedCount, ... } }
results            // kết quả GET /api/analysis/results của viewingTabId
```

**Nguyên tắc thiết kế quan trọng**:
- `currentTabId` → tab Chrome đang active (xác định qua `chrome.tabs.query` khi popup mount).
- `viewingTabId` **luôn mặc định = `currentTabId`** — popup mở ở tab nào thì mặc định xem session
  của tab đó, không tự nhảy sang session tab khác (đây là fix bug cross-session leak).
- Chỉ thay đổi `viewingTabId` khi user **chủ động** bấm vào một dòng trong tab "Tất cả phiên".
- Sau khi dừng session đang xem → lấy snapshot kết quả cuối cùng của ĐÚNG session đó rồi giữ
  nguyên (không auto-switch sang session khác).

**3 tab UI chính**:

| Tab | Nội dung |
|---|---|
| **Phiên hiện tại** | ControlPanel (Bắt đầu/Dừng cho tab Chrome đang active) + kết quả của `viewingTabId` |
| **Tất cả phiên** | RunningSessionsList (danh sách mọi session đang chạy ở mọi tab) + nút "Dừng tất cả" |
| **Tổng hợp toàn hệ thống** | AllUsersTable — dữ liệu tổng hợp xuyên session từ `GET /api/users` |

**Polling**: một interval `4000ms` duy nhất (chạy suốt lifetime của popup) gọi cả
`refreshRunningSessions()` và `fetchResultsForSession()` mỗi tick.

### 3.4 Detail page (`src/detail/`)

Trang riêng (`detail.html`, mở khi click vào tên người dùng trong bảng kết quả) hiển thị hồ sơ
chi tiết của một người: điểm trung bình có trọng số (weighted average theo số bài) qua tất cả
session, bảng lịch sử từng session (tooltip hiện breakdown 4 chỉ số), danh sách bài đăng đã thu
thập.

---

## 4. Backend (Node.js + Express)

**Công nghệ**: Node.js (ESM), Express 5, Prisma ORM, MySQL 8, BullMQ, Redis 7.

**Entry point**: `src/server.js` — khởi động cả Express HTTP server và BullMQ worker trong **cùng
một process**.

```js
// server.js
const app = createApp();    // Express
const worker = createAnalysisWorker();  // BullMQ worker
app.listen(env.port, env.host, ...);
```

`HOST=127.0.0.1` (mặc định production) → Node chỉ lắng nghe nội bộ, Nginx làm reverse proxy ra
ngoài và xử lý TLS.

### 4.1 REST API (`src/routes/`)

Base URL: `/api`

| Method | Endpoint | Controller | Mô tả |
|---|---|---|---|
| POST | `/sessions` | `postSession` | Tạo session mới, trả `{session_id, status}` |
| GET | `/sessions` | `getSessions` | Liệt kê sessions (phân trang, dùng cho tổng hợp) |
| POST | `/sessions/:session_id/stop` | `postSessionStop` | Đóng session, set `status=completed` |
| POST | `/analysis/batch` | `postBatch` | Tiếp nhận batch bài đăng, trả `202 Accepted` |
| GET | `/analysis/results/:session_id` | `getSessionResults` | Kết quả tổng hợp của session |
| GET | `/users` | `getUsers` | Danh sách tất cả người dùng xuyên session |
| GET | `/users/:user_id` | `getUserDetailHandler` | Chi tiết + lịch sử session của 1 user |
| GET | `/users/:user_id/posts` | `getUserPostsHandler` | Danh sách bài đăng của 1 user |

**Validation**: Zod schema cho toàn bộ request body/params (`src/validators/analysis.schema.js`).

**Error handling** (middleware cuối `app.js`):
- `ZodError` → 400 Bad Request
- `SessionNotFoundError` | `UserNotFoundError` → 404 Not Found
- `SessionNotRunningError` → 409 Conflict
- Khác → 500 Internal Server Error

### 4.2 Session lifecycle (`analysis.service.js`)

```
POST /api/sessions
  └── prisma.session.create({ session_uuid: uuidv4(), source_url, status: "running" })
  └── return { session_id: session_uuid, status: "running" }

POST /api/analysis/batch
  └── 1. findUnique session (phải tồn tại và status="running")
  └── 2. Với mỗi item trong batch:
         ├── Tính post_hash = sha256("profileUrl|content")
         ├── Cache check: postHashExists(post_hash, session_id) → skip nếu trùng trong session
         └── insertPost() (transaction):
               ├── SocialUser.upsert({ where: user_hash })
               │     user_hash = sha256("facebook:" + profileUrl)
               └── Post.create({ session_id, user_id, post_hash, content, post_url, source_url })
  └── 3. Nếu có bài mới → enqueueAnalysisJob(session_id, [postIds])
  └── 4. return { job_id, accepted, skipped_duplicates }

POST /api/sessions/:id/stop
  └── session.update({ status: "completed", ended_at: now() })
```

### 4.3 AI Analysis Pipeline (`queue/`, `services/ai.service.js`)

Phân tích AI **hoàn toàn bất đồng bộ** (không block HTTP request):

```
POST /api/analysis/batch → 202 Accepted (ngay lập tức)
    │
    └── BullMQ job enqueued (Redis)
            │
            ▼ (Worker xử lý async)
        processAnalysisJob(job):
          1. Load posts từ DB (post id + content)
          2. Chia thành chunk BATCH_SIZE = 20
          3. Với mỗi chunk:
              ├── content_hash = sha256(content.trim())
              ├── Cache hit? getCachedAnalysis(content_hash)
              │     └── YES: dùng lại kết quả, touchCachedAnalysis (tăng hit_count)
              └── NO: gọi analyzeBatch() → OpenAI API
                    └── Lưu kết quả: upsertCachedAnalysis() + upsertAnalysis()
          4. recalcUserScores() cho mỗi user có bài trong job
```

**Retry**: `AI_RETRY_ATTEMPTS = 2`, exponential backoff delay 2s. Nếu hết retry → job "failed",
bài không được phân tích, không ảnh hưởng đến việc lưu bài đăng.

#### AI Provider switch (`src/services/ai.service.js`)

Cấu hình qua `AI_PROVIDER` trong `.env`:

| Giá trị | Hành vi |
|---|---|
| `mock` | Sinh điểm số deterministic bằng SHA-256 hash nội dung (dev/test, không tốn tiền) |
| `openai` | Gọi OpenAI Chat Completions API với Structured Outputs (`response_format: json_schema`) |

**OpenAI call chi tiết**:
- Model: `env.aiModel` (mặc định `gpt-4o-mini`)
- `temperature: 0` (deterministic)
- System prompt: hướng dẫn chấm điểm 5 chỉ số 0-1 + gán nhãn enum + giải thích tiếng Việt
- Response format: JSON schema strict, buộc model trả đúng cấu trúc, tránh parse lỗi
- Timeout: 60s
- Error logging chi tiết: HTTP status, OpenAI error code/type, `Retry-After` header (khi 429)

#### Caching AI (`src/services/cache.service.js` + bảng `analysis_cache`)

**2 lớp dedup tách biệt**:

1. **Post-level dedup** (theo `post_hash = sha256(profileUrl|content)`): trong cùng 1 session,
   không nhận lại bài đăng giống hệt từ cùng người. Cho phép cùng bài xuất hiện ở session khác.

2. **Content-level AI cache** (theo `content_hash = sha256(content)`): không phân biệt ai đăng
   hay session nào — nếu nội dung text đã từng được AI phân tích, dùng lại kết quả. Giúp tiết
   kiệm chi phí API khi cùng 1 đoạn text được đăng lại nhiều lần bởi nhiều người khác nhau.

### 4.4 Aggregation (`src/services/aggregation.service.js`)

Sau mỗi job AI hoàn tất, `recalcUserScores(sessionId, userId)` tính lại điểm tổng hợp:

```
overall_risk_score = 
    avg_toxicity     × 0.30
  + avg_spam         × 0.15
  + avg_manipulation × 0.30
  + avg_extremism    × 0.25

risk_level:
  overall >= 0.7  → "high"
  overall >= 0.4  → "medium"
  otherwise       → "low"
```

Upsert vào bảng `user_scores` (`session_id + user_id` unique) → popup polling `GET /results/:id`
sẽ thấy kết quả cập nhật mỗi 4s.

### 4.5 GET /api/analysis/results/:session_id

Trả về snapshot hiện tại:
```json
{
  "session_id": "uuid",
  "status": "running | completed | failed",
  "summary": {
    "total_users": 12,
    "total_posts": 47,
    "processed_posts": 35     // số bài đã có post_analysis
  },
  "users": [
    {
      "user_id": "123",
      "display_name": "Nguyen Van A",
      "profile_url": "https://facebook.com/...",
      "post_count": 5,
      "overall_risk_score": 0.7823,
      "risk_level": "high",
      "avg_toxicity": 0.8100,
      "avg_spam": 0.2300,
      "avg_manipulation": 0.9100,
      "avg_extremism_risk": 0.5500
    }
    // ... sắp xếp giảm dần theo overall_risk_score
  ]
}
```

---

## 5. Database Schema (MySQL, Prisma)

```
sessions
  id (PK), session_uuid (UK), source_url, status(running/completed/failed),
  started_at, ended_at, created_at, updated_at

social_users
  id (PK), platform, external_user_id, display_name, profile_url,
  user_hash (UK, sha256 của profile), created_at, updated_at

posts
  id (PK), session_id (FK→sessions), user_id (FK→social_users),
  post_hash, content, post_url, source_url, collected_at, created_at
  UNIQUE(session_id, post_hash)

post_analysis             ← quan hệ 1-1 với posts
  id (PK), post_id (FK+UK→posts),
  toxicity_score, spam_score, manipulation_score, extremism_risk_score,
  sentiment_score, label, explanation, model_name, raw_response(JSON), created_at

analysis_cache            ← không có FK, độc lập hoàn toàn
  id (PK), content_hash (UK), [5 score fields], label, explanation,
  model_name, hit_count, created_at, updated_at

user_scores               ← aggregate theo session+user
  id (PK), session_id (FK), user_id (FK),
  avg_toxicity, max_toxicity, avg_spam, avg_manipulation,
  avg_extremism_risk, overall_risk_score, post_count,
  risk_level(low/medium/high), updated_at
  UNIQUE(session_id, user_id)
```

---

## 6. Multi-session support (tính năng nâng cao)

Hệ thống hỗ trợ **nhiều tab Facebook chạy đồng thời**, mỗi tab một session độc lập:

**Cơ chế hoạt động**:
- Background SW lưu map `{ tabId → session }` trong `chrome.storage.local`.
- Content script mỗi tab giữ `sessionId` riêng trong module scope (không share giữa các tab).
- Popup khi mở: xác định `currentTabId` (tab đang active), mặc định xem session của chính tab đó.
- Tab "Tất cả phiên" trong popup liệt kê toàn bộ session đang chạy, cho phép dừng bất kỳ session
  nào mà không cần switch tab Chrome.
- Khi đóng tab (chưa bấm Dừng): `chrome.tabs.onRemoved` tự gọi `stopSession` ở backend (atomic
  write map rỗng một lần, tránh race condition).

**Nguyên tắc isolation**: dừng session tab A không ảnh hưởng gì đến tab B (khác state, khác seenKeys,
khác session_id, khác kết quả hiển thị).

---

## 7. Cấu trúc thư mục dự án

```
project-root/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # DB schema, Prisma models
│   │   └── migrations/            # SQL migration files
│   ├── src/
│   │   ├── app.js                 # Express setup, middleware, error handler
│   │   ├── server.js              # Entry: start HTTP server + BullMQ worker
│   │   ├── config/env.js          # Đọc .env, export typed config
│   │   ├── controllers/           # Thin layer: validate req, call service, send res
│   │   ├── routes/                # Route declarations (session, analysis, user)
│   │   ├── services/
│   │   │   ├── analysis.service.js    # Session CRUD, batch ingestion, getResults
│   │   │   ├── ai.service.js          # AI analysis: mock + openai provider
│   │   │   ├── aggregation.service.js # recalcUserScores()
│   │   │   ├── cache.service.js       # postHashExists + AI cache CRUD
│   │   │   └── dashboard.service.js   # listSessions, listUsers, getUserDetail
│   │   ├── queue/
│   │   │   ├── analysis.queue.js  # BullMQ Queue + enqueueAnalysisJob()
│   │   │   └── analysis.worker.js # Worker: cache check → AI call → upsert → recalc
│   │   ├── validators/analysis.schema.js  # Zod schemas
│   │   ├── utils/
│   │   │   ├── constants.js       # BATCH_SIZE, RISK_WEIGHTS, RISK_THRESHOLDS...
│   │   │   ├── hash.js            # userHash, postHash, contentHash (SHA-256)
│   │   │   └── logger.js          # createLogger(scope) → console output
│   │   └── db/prisma.js           # PrismaClient singleton
│   ├── deploy/nginx.conf.example  # Nginx reverse proxy config cho production
│   ├── docker-compose.yml         # MySQL + Redis với persistent volumes
│   ├── ecosystem.config.cjs       # PM2 process manager config
│   └── .env.example               # Template cho environment variables
│
├── extension/
│   ├── src/
│   │   ├── background/serviceWorker.js    # BG: API gateway, session map, badge
│   │   ├── content/
│   │   │   ├── content.js          # Điều phối: scanAndSubmit, seenKeys, intervals
│   │   │   ├── collector.js        # DOM scraping: queryAllPosts, collectVisiblePosts
│   │   │   ├── observer.js         # MutationObserver: phát hiện bài mới
│   │   │   ├── autoScroll.js       # Auto-scroll 600px/2s
│   │   │   ├── highlighter.js      # CSS outline theo risk_level trực tiếp trên FB
│   │   │   └── domSelectors.js     # CSS selectors (multi-fallback vì FB obfuscate)
│   │   ├── popup/
│   │   │   ├── App.jsx             # Main component: state, handlers, routing
│   │   │   ├── styles.scss         # Global styles (CSS variables + BEM classes)
│   │   │   └── components/
│   │   │       ├── ControlPanel.jsx       # Bắt đầu / Dừng + status pill
│   │   │       ├── RunningSessionsList.jsx # Danh sách session + Dừng từng dòng
│   │   │       ├── CollectionStats.jsx    # 3 số: users / posts / analyzed
│   │   │       ├── UserScoreTable.jsx     # Bảng điểm rủi ro người dùng
│   │   │       ├── RiskFilter.jsx         # Bộ lọc Tất cả / Thấp / Trung bình / Cao
│   │   │       ├── AllUsersTable.jsx      # Bảng tổng hợp toàn hệ thống
│   │   │       └── StatusBadge.jsx        # Badge hiển thị risk_level
│   │   ├── detail/
│   │   │   └── Detail.jsx          # Trang chi tiết người dùng (popup mới)
│   │   ├── api/client.js           # Axios instance, interceptors, API functions
│   │   └── utils/constants.js      # BACKEND_BASE_URL (branch by MODE), MESSAGE_TYPES...
│   ├── manifest.json               # MV3 manifest: permissions, content_scripts, icons
│   ├── production.config.js        # PRODUCTION_BACKEND_ORIGIN = "https://extension-fb.xyz"
│   └── vite.config.js             # Vite config: crxjs plugin, dev/prod manifest swap
│
└── docs/
    ├── project-overview.md         # File này
    ├── database-er-diagram.md      # ER diagram (Mermaid)
    ├── store-listing.md            # Nội dung Chrome Web Store listing
    ├── privacy-policy.md           # Chính sách quyền riêng tư
    └── deploy-vps.md              # Hướng dẫn deploy lên VPS Ubuntu
```

---

## 8. Luồng sử dụng đầy đủ (end-to-end)

```
1. User mở nhóm Facebook (facebook.com/groups/...)
2. Click icon extension → Popup mở
3. Bấm "Bắt đầu":
   Popup → BG: CREATE_SESSION { sourceUrl, tabId }
   BG → Backend: POST /api/sessions
   Backend → trả session_uuid
   BG lưu { [tabId]: {sessionId, ...} } vào chrome.storage.local
   Popup → Content script: START_COLLECTION { sessionId }
   Content script: seenKeys.clear(), bắt đầu scan interval + observer + autoScroll

4. Thu thập tự động (mỗi 5s + khi có bài mới):
   Content script: collectVisiblePosts() → lọc seenKeys → batch
   Content script → BG: SUBMIT_BATCH { sessionId, items[] }
   BG → Backend: POST /api/analysis/batch
   Backend:
     a. Kiểm tra session còn running
     b. Với mỗi item: hash → dedup → insertPost (transaction: upsert user + create post)
     c. enqueueAnalysisJob(session_id, [newPostIds]) → Redis queue
     d. return { accepted, skipped_duplicates }

5. AI Worker xử lý async:
   Worker dequeue job → load posts
   Với mỗi post: content_hash → check analysis_cache
     Cache hit → dùng lại (tiết kiệm OpenAI API cost)
     Cache miss → gọi OpenAI API (batched, 1 call/20 bài) → lưu vào cache + post_analysis
   recalcUserScores() → upsert user_scores

6. Popup polling (mỗi 4s):
   App.jsx → BG: GET_RESULTS { sessionId }
   BG → Backend: GET /api/analysis/results/:id
   Backend → { status, summary, users[] sorted by risk score }
   Popup hiển thị bảng điểm

7. Content script highlight (mỗi 6s):
   Content → BG: GET_RESULTS
   highlighter.js: applyHighlights(users) → set data-sca-risk attribute + inject CSS

8. Bấm "Dừng":
   Popup → Content: STOP_COLLECTION → clearInterval, stopObserver, stopAutoScroll, clearHighlights
   Popup → BG: STOP_SESSION { sessionId, tabId }
   BG → Backend: POST /api/sessions/:id/stop → status = "completed"
   BG xóa entry khỏi map, cập nhật badge
   Popup: fetch final snapshot → hiển thị kết quả cuối
```

---

## 9. Key constants (`backend/src/utils/constants.js`)

| Constant | Giá trị | Ý nghĩa |
|---|---|---|
| `BATCH_SIZE` | 20 | Số post tối đa trong 1 AI call |
| `MAX_BATCH_SIZE` | 30 | Giới hạn item/batch từ extension (Zod validation) |
| `POST_MAX_LENGTH` | 10000 | Cắt nội dung bài tại 10k ký tự |
| `AI_RETRY_ATTEMPTS` | 2 | Số lần retry job AI khi lỗi |
| `RISK_WEIGHTS` | `{toxicity: 0.30, spam: 0.15, manipulation: 0.30, extremism: 0.25}` | Trọng số tính overall |
| `RISK_THRESHOLDS.highMin` | 0.7 | overall ≥ 0.7 → "high" |
| `RISK_THRESHOLDS.mediumMin` | 0.4 | overall ≥ 0.4 → "medium" |

| Constant (extension) | Giá trị | Ý nghĩa |
|---|---|---|
| `SCAN_INTERVAL_MS` | 5000 | Quét bài mỗi 5 giây |
| `POLL_INTERVAL_MS` | 4000 | Popup polling kết quả mỗi 4 giây |
| `HIGHLIGHT_INTERVAL_MS` | 6000 | Refresh highlight trên trang mỗi 6 giây |
| `AUTO_SCROLL_INTERVAL_MS` | 2000 | Cuộn 600px mỗi 2 giây |
| `OBSERVER_DEBOUNCE_MS` | 1000 | Debounce MutationObserver 1 giây |

---

## 10. Môi trường và deploy

### Development (local)

```
backend/.env:
  DATABASE_URL="mysql://root:root@localhost:3306/social_analyzer"
  REDIS_URL="redis://localhost:6379"
  AI_PROVIDER="mock"   # không cần API key, sinh điểm hash deterministic
  PORT=3000
  HOST=0.0.0.0         # cho phép bind tất cả interface khi dev local

extension: npm run build  (→ localhost:3000)
```

### Production (VPS Ubuntu + Docker)

```
backend/.env:
  DATABASE_URL="mysql://root:<password>@127.0.0.1:3306/social_analyzer"
  REDIS_URL="redis://:<password>@127.0.0.1:6379"
  AI_PROVIDER="openai"
  AI_API_KEY="sk-..."
  AI_MODEL="gpt-4o-mini"
  HOST=127.0.0.1        # chỉ bind localhost, Nginx làm reverse proxy
  CORS_ORIGIN="chrome-extension://<extension-id>"

Stack:
  - Docker Compose: MySQL 8 + Redis 7 (volumes persistent, bind 127.0.0.1)
  - PM2: chạy Node process với autorestart
  - Nginx: HTTPS termination (Let's Encrypt) + reverse proxy → localhost:3000
  - Domain: extension-fb.xyz

extension: npm run build:production  (→ https://extension-fb.xyz)
```

---

## 11. Điểm quan trọng cần lưu ý khi làm việc với codebase

1. **Service worker ephemeral**: MV3 SW bị unload sau ~30s idle → LUÔN dùng `chrome.storage.local`
   thay vì biến module cho bất kỳ state nào cần tồn tại lâu dài.

2. **Không auto-switch view session**: popup luôn xem session của tab mình đang mở. Việc xem
   session khác CHỈ xảy ra khi user click chủ động vào tab "Tất cả phiên".

3. **Facebook DOM selectors bất ổn**: class name bị obfuscate và thay đổi theo thời gian.
   `domSelectors.js` dùng multi-fallback selectors. Nếu thu thập không hoạt động, đây là nơi
   đầu tiên cần kiểm tra và cập nhật.

4. **`seenKeys` chỉ clear khi session mới**: bài đã gửi trong session không bao giờ gửi lại dù
   re-scan nhiều lần. Đây là intentional, không phải bug.

5. **Race condition "stop all"**: `STOP_ALL_SESSIONS` được xử lý atomic trong background (1 lần
   read + write map rỗng) — không gọi STOP_SESSION riêng lẻ parallel để tránh race condition
   trên `chrome.storage.local`.

6. **AI_PROVIDER=openai**: khi chạy lần đầu, cần đảm bảo tài khoản OpenAI đã có billing.
   `insufficient_quota` và `rate_limit_exceeded` là 2 lỗi phổ biến nhất. Backend log đầy đủ
   HTTP status + error code + Retry-After header để debug.

7. **Build mode split**: `npm run build` (dev → localhost) vs `npm run build:production` (prod →
   extension-fb.xyz). Hai lệnh này khác nhau ở `import.meta.env.MODE` (không phải `PROD`).
