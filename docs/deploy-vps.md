# Deploy backend + database lên VPS

Hướng dẫn này giả định VPS chạy **Ubuntu 22.04/24.04** (phổ biến nhất ở các nhà cung cấp VPS).
Nếu VPS bạn dùng distro khác (Debian/CentOS/AlmaLinux...), báo lại để đổi câu lệnh cài đặt cho
đúng (khác ở bước cài Docker/Nginx, còn lại tương tự).

Domain dùng trong hướng dẫn: **extension-fb.xyz** (đã đặt trong
[extension/production.config.js](../extension/production.config.js) và
[extension/manifest.json](../extension/manifest.json)).

## 0. Trước khi bắt đầu

- Trỏ DNS: tạo bản ghi **A** `extension-fb.xyz` → IP của VPS (ở nơi bạn mua domain). Đợi DNS
  propagate (thường vài phút, có thể tới 30 phút) trước khi xin SSL ở bước 6.
- Có sẵn: `AI_API_KEY` (OpenAI), thông tin SSH VPS (IP, user, password/SSH key) do nhà cung cấp gửi.

## 1. SSH vào VPS & cập nhật hệ thống

```bash
ssh root@<IP_VPS>
apt update && apt upgrade -y
```

Nên tạo user riêng (không chạy mọi thứ bằng `root`):

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

(Từ giờ chạy các lệnh dưới bằng user `deploy`, thêm `sudo` khi cần quyền root.)

## 2. Firewall (ufw)

Chỉ mở cổng cần thiết — **không** mở 3000 (Node), 3306 (MySQL), 6379 (Redis) ra ngoài:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

## 3. Cài Docker (chạy MySQL + Redis)

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

Đăng xuất/đăng nhập lại (hoặc `newgrp docker`) để áp dụng quyền chạy `docker` không cần `sudo`.

## 4. Cài Node.js (LTS) + pm2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # kiểm tra >= 20
npm install -g pm2
```

## 5. Lấy code lên VPS

```bash
sudo apt install -y git
git clone <URL_REPO_CUA_BAN> social-analyzer
cd social-analyzer/backend
```

(Nếu repo private và bạn chưa cấu hình SSH key/token trên VPS, dùng `scp -r` từ máy local thay
cho `git clone`, hoặc setup deploy key trước.)

## 6. Cấu hình `.env` production

```bash
cp .env.example .env
nano .env
```

Điền theo mẫu (đổi `<...>` thành giá trị thật, dùng **mật khẩu mạnh, khác nhau** cho từng dòng):

```ini
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

# Dùng CHUNG giá trị password này ở DATABASE_URL bên dưới (docker-compose đọc
# trực tiếp từ file .env này).
MYSQL_ROOT_PASSWORD=<mat-khau-mysql-manh>
DATABASE_URL="mysql://root:<mat-khau-mysql-manh>@127.0.0.1:3306/social_analyzer"

REDIS_PASSWORD=<mat-khau-redis-manh>
REDIS_URL="redis://:<mat-khau-redis-manh>@127.0.0.1:6379"

AI_PROVIDER=openai
AI_API_KEY=<openai-api-key-cua-ban>
AI_MODEL=gpt-4o-mini

# Sau khi đăng tải extension lên Chrome Web Store (hoặc test bằng "Load
# unpacked"), lấy extension ID ở chrome://extensions và điền vào đây - CORS
# chỉ cho phép đúng origin này gọi API.
CORS_ORIGIN="chrome-extension://<EXTENSION_ID_THUC_TE>"
```

> `HOST=127.0.0.1` + để Nginx (bước 8) làm cửa ngõ public duy nhất — Node không lộ trực tiếp ra
> internet.

## 7. Khởi động MySQL + Redis, migrate DB, chạy backend

```bash
docker compose up -d          # đọc backend/docker-compose.yml + backend/.env
docker compose ps             # kiểm tra cả 2 container đang "healthy"/"Up"

npm ci
npx prisma generate
npx prisma migrate deploy     # áp tất cả migration có sẵn trong prisma/migrations, không hỏi gì

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                   # in ra 1 lệnh sudo - copy & chạy lệnh đó để pm2 tự khởi động lại sau khi VPS reboot
```

Kiểm tra nhanh (chạy trên VPS, chưa qua Nginx):

```bash
curl http://127.0.0.1:3000/api/health
# {"status":"ok"}
pm2 logs social-analyzer-backend --lines 50
```

## 8. Nginx reverse proxy + HTTPS (Let's Encrypt)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/extension-fb.xyz
sudo ln -s /etc/nginx/sites-available/extension-fb.xyz /etc/nginx/sites-enabled/
sudo nginx -t                 # kiểm tra cú pháp
sudo systemctl reload nginx

sudo certbot --nginx -d extension-fb.xyz
# certbot sẽ tự sửa file Nginx để thêm HTTPS (443) + redirect HTTP -> HTTPS
```

Certbot tự đặt cron/systemd timer renew chứng chỉ — kiểm tra bằng `sudo certbot renew --dry-run`.

## 9. Kiểm tra từ máy local (không phải VPS)

```bash
curl https://extension-fb.xyz/api/health
# {"status":"ok"}
```

Nếu lỗi SSL/timeout: kiểm tra lại DNS đã trỏ đúng IP chưa (`dig extension-fb.xyz`), `ufw status`,
và `sudo nginx -t`.

## 10. Build extension bản production và cập nhật CORS

```bash
# Trên máy local, trong thư mục extension/
npm run build:production
```

Load `extension/dist` qua `chrome://extensions` (Developer mode → Load unpacked) để lấy
**Extension ID**, rồi quay lại bước 6 trên VPS, điền ID đó vào `CORS_ORIGIN`, sau đó:

```bash
pm2 restart social-analyzer-backend
```

## Vận hành & bảo trì

- **Xem log**: `pm2 logs social-analyzer-backend`
- **Restart sau khi đổi code/`.env`**: `git pull && npm ci && pm2 restart social-analyzer-backend`
- **Backup MySQL** (nên đặt cron hàng ngày):
  ```bash
  docker exec social-analyzer-mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" social_analyzer > backup_$(date +%F).sql
  ```
- **Theo dõi tài nguyên**: `pm2 monit`, `docker stats`
- **Migration mới** (khi `backend/prisma/schema.prisma` thay đổi ở lần deploy sau):
  ```bash
  npx prisma migrate deploy
  pm2 restart social-analyzer-backend
  ```
