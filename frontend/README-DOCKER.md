# 🐳 Docker Frontend - Hệ thống chấm công vân tay

Hướng dẫn chạy frontend với Docker (Backend chạy riêng).

## 📋 Yêu cầu

- Docker >= 20.10
- Backend đang chạy tại http://localhost:8080

## 🚀 Cài đặt nhanh

### 1. Tạo file .env

```bash
# Copy từ template
cp .env.example .env
```

Nội dung `.env`:
```env
FRONTEND_PORT=3000
BACKEND_URL=http://localhost:8080
```

### 2. Build và chạy frontend

```bash
# Build và start
docker-compose up -d --build

# Hoặc chỉ build
docker-compose build

# Sau đó start
docker-compose up -d
```

### 3. Kiểm tra

```bash
# Xem logs
docker-compose logs -f

# Kiểm tra container
docker-compose ps

# Xem logs realtime
docker-compose logs -f frontend
```

### 4. Truy cập

- **Frontend**: http://localhost:3000
- **Backend** (đang chạy riêng): http://localhost:8080

## 🏗️ Kiến trúc

```
Browser
   ↓
Frontend Container (Nginx:3000)
   ↓ /api → proxy
Backend (Host Machine:8080)
   ↓
Database
```

Frontend chạy trong Docker, backend chạy trên host machine.

## 🔧 Các lệnh hữu ích

### Quản lý container

```bash
# Stop frontend
docker-compose down

# Restart frontend
docker-compose restart

# Rebuild sau khi sửa code
docker-compose up -d --build
```

### Xem logs

```bash
# Tất cả logs
docker-compose logs

# Logs realtime
docker-compose logs -f

# 100 dòng cuối
docker-compose logs --tail=100
```

### Debug

```bash
# Vào trong container
docker-compose exec frontend sh

# Kiểm tra nginx config
docker-compose exec frontend nginx -t

# Reload nginx
docker-compose exec frontend nginx -s reload
```

## 📝 Cấu hình

### Thay đổi port frontend

Trong file `.env`:
```env
FRONTEND_PORT=8080  # Thay đổi port
```

### Thay đổi backend URL

Trong file `.env`:
```env
BACKEND_URL=http://localhost:5000  # Nếu backend chạy port khác
```

Sau đó rebuild:
```bash
docker-compose down
docker-compose up -d --build
```

## 🔄 Update code

```bash
# Pull code mới
git pull

# Rebuild và restart
docker-compose up -d --build
```

## 🐛 Troubleshooting

### Port 3000 đã được sử dụng

```bash
# Thay đổi port trong .env
FRONTEND_PORT=8000

# Restart
docker-compose up -d
```

### Không kết nối được backend

Kiểm tra:
1. Backend đang chạy: `curl http://localhost:8080/api/health`
2. Port backend đúng trong nginx.conf
3. Xem logs: `docker-compose logs frontend`

### Cache cũ

```bash
# Clear và rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Tính năng Nginx

- ✅ **Gzip compression** - Giảm 70% kích thước transfer
- ✅ **Static caching** - Cache assets 1 năm
- ✅ **Security headers** - X-Frame-Options, XSS-Protection
- ✅ **React Router** - SPA routing support
- ✅ **API Proxy** - `/api` → Backend tự động

## 🎯 Production Tips

1. **Thay đổi port** production (80 hoặc 443)
2. **SSL/HTTPS** với reverse proxy
3. **Monitor** với Portainer hoặc Grafana
4. **Backup** images: `docker save attendance-frontend > frontend.tar`
5. **Resource limits** trong docker-compose.yml

## 📄 Files

```
frontend/
├── Dockerfile          # Multi-stage build
├── nginx.conf          # Nginx configuration
└── .dockerignore       # Ignore files

Root:
├── docker-compose.yml  # Orchestration
└── .env               # Configuration
```

## 🚀 Quick Commands

```bash
# Start
docker-compose up -d --build

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build --force-recreate
```
