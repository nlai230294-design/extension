# Sơ đồ ER cơ sở dữ liệu

Dựa trên [backend/prisma/schema.prisma](../backend/prisma/schema.prisma).

```mermaid
erDiagram
    SESSION ||--o{ POST : "has"
    SESSION ||--o{ USER_SCORE : "has"
    SOCIAL_USER ||--o{ POST : "writes"
    SOCIAL_USER ||--o{ USER_SCORE : "has"
    POST ||--o| POST_ANALYSIS : "analyzed_as"

    SESSION {
        bigint id PK
        varchar session_uuid UK
        text source_url
        enum status
        datetime started_at
        datetime ended_at
        datetime created_at
        datetime updated_at
    }

    SOCIAL_USER {
        bigint id PK
        varchar platform
        varchar external_user_id
        varchar display_name
        text profile_url
        varchar user_hash UK
        datetime created_at
        datetime updated_at
    }

    POST {
        bigint id PK
        bigint session_id FK
        bigint user_id FK
        varchar post_hash
        text content
        text post_url
        text source_url
        datetime collected_at
        datetime created_at
    }

    POST_ANALYSIS {
        bigint id PK
        bigint post_id FK_UK
        decimal toxicity_score
        decimal spam_score
        decimal manipulation_score
        decimal extremism_risk_score
        decimal sentiment_score
        varchar label
        text explanation
        varchar model_name
        json raw_response
        datetime created_at
    }

    ANALYSIS_CACHE {
        bigint id PK
        varchar content_hash UK
        decimal toxicity_score
        decimal spam_score
        decimal manipulation_score
        decimal extremism_risk_score
        decimal sentiment_score
        varchar label
        text explanation
        varchar model_name
        int hit_count
        datetime created_at
        datetime updated_at
    }

    USER_SCORE {
        bigint id PK
        bigint session_id FK
        bigint user_id FK
        decimal avg_toxicity
        decimal max_toxicity
        decimal avg_spam
        decimal avg_manipulation
        decimal avg_extremism_risk
        decimal overall_risk_score
        int post_count
        enum risk_level
        datetime updated_at
    }
```

## Ghi chú

- `ANALYSIS_CACHE` không có quan hệ khóa ngoại với các bảng khác — nó cache kết quả phân tích AI theo `content_hash` (hash nội dung), độc lập với người đăng hay session, để tái sử dụng kết quả khi nội dung trùng lặp được đăng lại.
- `POST` có ràng buộc unique trên `(session_id, post_hash)` — một bài viết không bị trùng trong cùng một session.
- `USER_SCORE` có ràng buộc unique trên `(session_id, user_id)` — mỗi user chỉ có một điểm tổng hợp trên mỗi session.
- `POST_ANALYSIS.post_id` là 1-1 với `POST` (unique FK).

## Công dụng và trường chính của từng bảng

### `sessions` — một lượt thu thập/quét dữ liệu
Đại diện cho một lần chạy crawl/scan (ví dụ: quét một trang Facebook, một thời điểm). Là gốc để nhóm các bài post và điểm rủi ro người dùng theo từng lượt quét riêng biệt.

- `id` (PK): khóa định danh nội bộ, dùng để liên kết FK từ `posts`, `user_scores`.
- `session_uuid` (UK): mã định danh công khai/ổn định cho session, dùng khi tra cứu từ bên ngoài (API, log) mà không lộ `id` tăng dần.
- `source_url`: URL gốc được quét (trang/group/profile mục tiêu).
- `status`: trạng thái vòng đời (`running` / `completed` / `failed`) — phục vụ theo dõi tiến trình quét.
- `started_at` / `ended_at`: mốc thời gian bắt đầu/kết thúc, dùng tính thời lượng quét.

### `social_users` — danh tính người đăng bài (đã ẩn danh hóa)
Lưu thông tin người dùng mạng xã hội bị thu thập, tách riêng khỏi `posts` để một người có thể xuất hiện ở nhiều bài/nhiều session mà không lặp dữ liệu định danh.

- `id` (PK): liên kết FK từ `posts`, `user_scores`.
- `user_hash` (UK): hash định danh người dùng (ẩn danh hóa `external_user_id`), dùng để nhận diện "cùng một người" qua các lần quét mà không lưu ID gốc lộ liễu.
- `platform`: nền tảng nguồn (mặc định `facebook`) — chuẩn bị cho việc hỗ trợ nhiều nền tảng.
- `external_user_id` / `display_name` / `profile_url`: thông tin gốc từ nền tảng, có thể null nếu chỉ có hash.

### `posts` — nội dung bài đăng đã thu thập
Bảng trung tâm nối `sessions` và `social_users`; mỗi bản ghi là một bài đăng cụ thể được quét trong một session.

- `id` (PK): liên kết 1-1 tới `post_analysis`.
- `session_id` (FK → sessions): bài này thuộc lượt quét nào.
- `user_id` (FK → social_users): ai là người đăng.
- `post_hash`: hash nội dung bài viết, dùng cùng `session_id` tạo unique constraint `(session_id, post_hash)` để chống thu thập trùng lặp trong một session.
- `content`: nội dung văn bản thực tế — đầu vào cho việc phân tích AI.
- `post_url`: liên kết tới bài gốc trên nền tảng.

### `post_analysis` — kết quả phân tích AI cho một bài đăng cụ thể
Quan hệ 1-1 với `posts`, lưu điểm số rủi ro do mô hình AI/NLP sinh ra cho từng bài, gắn với đúng người đăng và session đó.

- `id` (PK).
- `post_id` (FK, UK → posts): đảm bảo mỗi bài chỉ có một bản phân tích.
- `toxicity_score`, `spam_score`, `manipulation_score`, `extremism_risk_score`, `sentiment_score`: các điểm số (0–1, `Decimal(5,4)`) theo từng khía cạnh rủi ro nội dung.
- `label`: nhãn phân loại tổng quát do model gán (ví dụ "toxic", "spam"...).
- `model_name` / `raw_response`: ghi lại model nào đã chạy và phản hồi thô (JSON) để truy vết/debug.

### `analysis_cache` — cache kết quả phân tích theo nội dung (độc lập post/user)
Không có FK tới bảng khác — mục đích là tránh gọi lại AI khi cùng một nội dung text xuất hiện ở nhiều bài/nhiều người/nhiều session khác nhau, giúp tiết kiệm chi phí gọi model.

- `id` (PK).
- `content_hash` (UK): hash của nội dung văn bản — khóa tra cứu cache, không phụ thuộc ai đăng hay session nào.
- Các trường điểm số (`toxicity_score`...) giống `post_analysis`, là kết quả được tái sử dụng.
- `hit_count`: số lần cache được dùng lại — đo hiệu quả cache/tần suất nội dung trùng lặp.

### `user_scores` — điểm rủi ro tổng hợp của một người dùng trong một session
Bảng tổng hợp (aggregate) từ nhiều `post_analysis` của cùng một người trong cùng một session, dùng để xếp hạng/cảnh báo người dùng nguy cơ cao mà không cần join lại toàn bộ bài viết.

- `id` (PK).
- `session_id` (FK → sessions) + `user_id` (FK → social_users): cặp khóa unique `(session_id, user_id)` — mỗi người chỉ có một điểm tổng hợp mỗi session.
- `avg_toxicity`, `max_toxicity`, `avg_spam`, `avg_manipulation`, `avg_extremism_risk`: số liệu thống kê (trung bình/tối đa) từ các bài viết của người đó.
- `overall_risk_score`: điểm rủi ro tổng hợp cuối cùng, dùng để so sánh nhanh giữa các user.
- `post_count`: số bài đã tính vào điểm này — cho biết độ tin cậy của số liệu (ít bài thì điểm kém ổn định).
- `risk_level`: phân loại rủi ro rời rạc (`low`/`medium`/`high`) suy ra từ `overall_risk_score`, dùng để lọc/UI hiển thị nhanh.
