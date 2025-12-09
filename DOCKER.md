# 🐳 Docker Deployment Guide

Hướng dẫn deploy hệ thống chấm công vân tay sử dụng Docker và Docker Compose.

## 📋 Yêu cầu

- Docker >= 20.10
- Docker Compose >= 2.0

## 🚀 Cài đặt nhanh

### 1. Clone repository và cấu hình

```bash
# Clone project
git clone <repository-url>
cd time-attendance-machine

# Tạo file .env từ template
cp .env.example .env
```

### 2. Chỉnh sửa file .env

```env
# Database
DB_ROOT_PASSWORD=your_secure_root_password
DB_NAME=attendance_db
DB_USER=attendance_user
DB_PASSWORD=your_secure_password
DB_PORT=3306

# Backend
BACKEND_PORT=5000
JWT_SECRET=your_jwt_secret_key_minimum_32_characters

# Frontend
FRONTEND_PORT=80
```

### 3. Build và chạy

```bash
# Build và start tất cả services
docker-compose up -d --build

# Hoặc chỉ build
docker-compose build

# Sau đó start
docker-compose up -d
```

### 4. Kiểm tra trạng thái

```bash
# Xem logs
docker-compose logs -f

# Xem logs của service cụ thể
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f database

# Kiểm tra containers đang chạy
docker-compose ps
```

### 5. Truy cập ứng dụng

- **Frontend**: http://localhost (hoặc port đã cấu hình trong FRONTEND_PORT)
- **Backend API**: http://localhost:5000
- **Database**: localhost:3306

## 🏗️ Kiến trúc Docker

```
┌─────────────────────────────────────────────┐
│              Frontend (Nginx)               │
│         Port: 80 (configurable)             │
└──────────────────┬──────────────────────────┘
                   │ /api → proxy
┌──────────────────▼──────────────────────────┐
│         Backend (Node.js/Express)           │
│         Port: 5000 (configurable)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│            Database (MySQL 8.0)             │
│         Port: 3306 (configurable)           │
└─────────────────────────────────────────────┘
```

## 📦 Services

### Frontend
- **Image**: Nginx Alpine
- **Build**: Multi-stage (Node 18 → Nginx)
- **Port**: 80 (mặc định)
- **Features**:
  - React app build optimized
  - Gzip compression
  - Static assets caching
  - API proxy to backend
  - React Router support

### Backend
- **Image**: Node 18 Alpine
- **Port**: 5000 (mặc định)
- **Features**:
  - Production dependencies only
  - Health check endpoint
  - Auto-restart on failure
  - Volume for uploads

### Database
- **Image**: MySQL 8.0
- **Port**: 3306 (mặc định)
- **Features**:
  - Persistent data volume
  - Health check
  - Auto-restart

## 🔧 Các lệnh Docker hữu ích

### Quản lý containers

```bash
# Stop tất cả services
docker-compose down

# Stop và xóa volumes (xóa database!)
docker-compose down -v

# Restart service cụ thể
docker-compose restart frontend
docker-compose restart backend

# Rebuild service cụ thể
docker-compose up -d --build frontend
```

### Xem logs

```bash
# Tất cả logs
docker-compose logs

# Logs realtime
docker-compose logs -f

# Logs của service cụ thể
docker-compose logs backend

# Logs 100 dòng cuối
docker-compose logs --tail=100
```

### Truy cập container

```bash
# Vào backend container
docker-compose exec backend sh

# Vào database container
docker-compose exec database mysql -u root -p

# Chạy lệnh trong container
docker-compose exec backend npm run migrate
```

### Database backup & restore

```bash
# Backup database
docker-compose exec database mysqldump -u root -p attendance_db > backup.sql

# Restore database
docker-compose exec -T database mysql -u root -p attendance_db < backup.sql
```

## 🔐 Bảo mật

### Production checklist

- [ ] Đổi tất cả passwords mặc định trong `.env`
- [ ] Sử dụng JWT_SECRET dài và random (>= 32 ký tự)
- [ ] Không expose database port ra ngoài (comment dòng `ports` trong service `database`)
- [ ] Sử dụng HTTPS với reverse proxy (Nginx, Traefik, Caddy)
- [ ] Giới hạn access database chỉ từ backend network
- [ ] Backup database thường xuyên
- [ ] Update Docker images định kỳ

### Ẩn database port

Trong `docker-compose.yml`, comment hoặc xóa:

```yaml
database:
  # ports:
  #   - "${DB_PORT:-3306}:3306"
```

## 🌐 Reverse Proxy (Production)

### Sử dụng Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL với Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Lấy SSL certificate
sudo certbot --nginx -d yourdomain.com
```

## 📊 Monitoring

### Health checks

```bash
# Frontend health
curl http://localhost/

# Backend health
curl http://localhost:5000/health

# Database health
docker-compose exec database mysqladmin ping -h localhost -u root -p
```

### Resource usage

```bash
# Xem CPU, Memory usage
docker stats

# Xem disk usage
docker system df
```

## 🐛 Troubleshooting

### Frontend không load được

```bash
# Check nginx logs
docker-compose logs frontend

# Kiểm tra file build
docker-compose exec frontend ls -la /usr/share/nginx/html
```

### Backend không kết nối database

```bash
# Check database health
docker-compose ps

# Check backend logs
docker-compose logs backend

# Verify database connection
docker-compose exec backend nc -zv database 3306
```

### Database không start

```bash
# Check logs
docker-compose logs database

# Xóa và tạo lại (MẤT DỮ LIỆU!)
docker-compose down -v
docker-compose up -d
```

## 🔄 Update & Deployment

### Update code và rebuild

```bash
# Pull latest code
git pull

# Rebuild và restart
docker-compose up -d --build

# Hoặc rebuild service cụ thể
docker-compose up -d --build frontend
```

### Zero-downtime deployment

```bash
# Build new images
docker-compose build

# Update services one by one
docker-compose up -d --no-deps frontend
docker-compose up -d --no-deps backend
```

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DB_ROOT_PASSWORD | rootpassword | MySQL root password |
| DB_NAME | attendance_db | Database name |
| DB_USER | attendance_user | Database user |
| DB_PASSWORD | attendance_pass | Database password |
| DB_PORT | 3306 | MySQL port |
| BACKEND_PORT | 5000 | Backend API port |
| FRONTEND_PORT | 80 | Frontend web port |
| JWT_SECRET | - | JWT secret key (REQUIRED) |

## 🎯 Development vs Production

### Development

```bash
# Use docker-compose.dev.yml for dev
docker-compose -f docker-compose.dev.yml up
```

### Production

```bash
# Use default docker-compose.yml
docker-compose up -d

# With custom env file
docker-compose --env-file .env.production up -d
```

## 📄 License

MIT
