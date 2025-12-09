# 🕐 Hệ thống chấm công vân tay

Hệ thống chấm công vân tay sử dụng thiết bị IoT, bao gồm backend Node.js/Express và frontend React.

## 📁 Cấu trúc project

```
time-attendance-machine/
├── backend/           # Backend API (Node.js/Express)
│   ├── controllers/   # Controllers
│   ├── routes/        # API routes
│   ├── models/        # Database models
│   └── ...
└── frontend/          # Frontend (React + Vite)
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   └── ...
    └── ...
```

## 🚀 Hướng dẫn cài đặt

### Backend
```bash
cd backend
npm install
npm start
```
Backend sẽ chạy tại: http://localhost:5000

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend sẽ chạy tại: http://localhost:5173

Chi tiết cài đặt frontend: [frontend/SETUP.md](frontend/SETUP.md)

## 🗄️ Database Schema

### User table
- `id`: ID người dùng
- `username`: Tên đăng nhập
- `password`: Mật khẩu (đã mã hóa)
- `position`: Chức vụ

### Employee table
- `id`: ID nhân viên
- `name`: Họ tên
- `position`: Chức vụ
- `identificationNum`: Số CCCD
- `email`: Email
- `phoneNum`: Số điện thoại
- `fingerPrint`: Dữ liệu vân tay

### Record table
- `id`: ID bản ghi
- `time`: Thời gian chấm công
- `device`: Thiết bị
- `imagePath`: Đường dẫn ảnh
- `isCheckIn`: 1 = vào, 0 = ra
- `note`: Ghi chú
- `Userid`: ID người dùng
- `Employeeid`: ID nhân viên

## 🔌 API Endpoints

### Authentication (`/api/auth`)
- `POST /login` - Đăng nhập
- `GET /me` - Lấy thông tin user
- `POST /change-password` - Đổi mật khẩu
- `POST /refresh` - Refresh token

### Employees (`/api/employees`)
- `GET /` - Lấy danh sách
- `GET /:id` - Chi tiết nhân viên
- `GET /search/:name` - Tìm kiếm
- `POST /` - Thêm mới
- `PUT /:id` - Cập nhật
- `DELETE /:id` - Xóa

### Records (`/api/records`)
- `GET /` - Lấy danh sách (filter: start_date, end_date)
- `GET /today` - Chấm công hôm nay
- `GET /statistics` - Thống kê
- `POST /manual` - Thêm thủ công
- `DELETE /:id` - Xóa

### Device (`/api/device`)
- `POST /checkin` - Checkin từ thiết bị
- `POST /enroll-notify` - Thông báo đăng ký vân tay
- `GET /status` - Trạng thái thiết bị

## 🎨 Tech Stack

### Backend
- Node.js
- Express.js
- Sequelize ORM
- MySQL/PostgreSQL
- JWT Authentication

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router v6
- React Query
- Zustand
- Axios
- Recharts

## 📱 Tính năng

- ✅ Đăng nhập/xác thực
- ✅ Quản lý nhân viên
- ✅ Chấm công vân tay
- ✅ Xem lịch sử chấm công
- ✅ Thống kê Dashboard
- ✅ Export báo cáo
- ✅ Responsive design

## 📄 License

MIT
