# 🚀 Hướng dẫn cài đặt Frontend - Hệ thống chấm công vân tay

## 📋 Yêu cầu hệ thống

- Node.js >= 16.x
- npm hoặc yarn
- Backend API đang chạy tại http://localhost:5000

## ⚡ Cài đặt nhanh

### 1. Cài đặt dependencies

```bash
cd frontend
npm install
```

### 2. Cấu hình môi trường

Tạo file `.env` trong thư mục `frontend`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Chạy development server

```bash
npm run dev
```

Ứng dụng sẽ chạy tại: http://localhost:5173

## 🏗️ Build cho production

```bash
npm run build
```

File build sẽ nằm trong thư mục `dist/`

## 📱 Tính năng chính

### 1. **Dashboard (Tổng quan)**
- Thống kê tổng số nhân viên
- Số lượng check-in/check-out hôm nay
- Biểu đồ chấm công theo tuần
- Danh sách chấm công gần đây (realtime)

### 2. **Quản lý nhân viên**
- Thêm/sửa/xóa nhân viên
- Tìm kiếm nhân viên theo tên
- Thông tin: Họ tên, CCCD, Email, SĐT, Chức vụ, Vân tay
- Export danh sách

### 3. **Chấm công**
- Xem lịch sử chấm công
- Lọc theo khoảng thời gian
- Hiển thị: Nhân viên, thời gian, loại (vào/ra), thiết bị
- Tìm kiếm theo tên nhân viên
- Export báo cáo

### 4. **Cài đặt**
- Đổi mật khẩu người dùng

## 🗂️ Cấu trúc project

```
frontend/
├── src/
│   ├── components/          # Components tái sử dụng
│   │   ├── ui/             # UI components (Button, Card, Input, Modal, Table, Badge)
│   │   └── layout/         # Layout components (Sidebar, Header, Layout)
│   ├── pages/              # Các trang chính
│   │   ├── Login.jsx       # Đăng nhập
│   │   ├── Dashboard.jsx   # Tổng quan
│   │   ├── Employees.jsx   # Quản lý nhân viên
│   │   ├── Attendance.jsx  # Chấm công
│   │   └── Settings.jsx    # Cài đặt
│   ├── services/           # API service layer
│   │   ├── api.js          # Axios instance
│   │   └── index.js        # Auth, Employee, Record, Device services
│   ├── store/              # State management
│   │   └── authStore.js    # Zustand auth store
│   ├── utils/              # Utilities
│   │   ├── dateUtils.js    # Date formatting
│   │   └── helpers.js      # Helper functions
│   ├── App.jsx             # Main app
│   └── main.jsx            # Entry point
├── .env                    # Environment variables
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🔌 API Endpoints sử dụng

### Authentication
- `POST /auth/login` - Đăng nhập
- `GET /auth/me` - Lấy thông tin user
- `POST /auth/change-password` - Đổi mật khẩu
- `POST /auth/refresh` - Refresh token

### Employees
- `GET /employees` - Lấy danh sách nhân viên
- `GET /employees/:id` - Lấy thông tin 1 nhân viên
- `GET /employees/search/:name` - Tìm kiếm theo tên
- `POST /employees` - Thêm nhân viên mới
- `PUT /employees/:id` - Cập nhật nhân viên
- `DELETE /employees/:id` - Xóa nhân viên

### Records (Chấm công)
- `GET /records` - Lấy danh sách chấm công (có filter start_date, end_date)
- `GET /records/today` - Lấy chấm công hôm nay
- `GET /records/statistics` - Lấy thống kê
- `POST /records/manual` - Thêm chấm công thủ công
- `DELETE /records/:id` - Xóa bản ghi

### Device
- `POST /device/checkin` - Checkin từ thiết bị
- `POST /device/enroll-notify` - Thông báo đăng ký vân tay
- `GET /device/status` - Trạng thái thiết bị

## 🎨 Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router v6** - Routing
- **React Query** - Data fetching
- **Zustand** - State management
- **Axios** - HTTP client
- **Recharts** - Charts
- **Lucide React** - Icons
- **React Hot Toast** - Notifications

## 🔐 Authentication

Hệ thống sử dụng JWT authentication:
1. Login với username/password
2. Nhận JWT token và lưu vào localStorage
3. Tự động attach token vào header mỗi request
4. Auto refresh token khi hết hạn
5. Redirect về login nếu unauthorized

## 💡 Lưu ý quan trọng

1. **Database schema** - Hệ thống chỉ có 3 tables:
   - `User`: id, username, password, position
   - `Employee`: id, name, position, identificationNum, email, phoneNum, fingerPrint
   - `Record`: id, time, device, imagePath, isCheckIn, note, Userid, Employeeid

2. **API Response format**:
```json
{
  "status": "success",
  "data": { ... },
  "message": "Success message"
}
```

3. **Token storage**: JWT token được lưu trong localStorage với key "token"

4. **Proxy**: Vite proxy `/api` requests đến `http://localhost:5000`

## 🐛 Troubleshooting

### Port 5173 đã được sử dụng
```bash
# Thay đổi port trong vite.config.js
server: {
  port: 3000
}
```

### Backend không kết nối được
- Kiểm tra backend đang chạy tại http://localhost:5000
- Kiểm tra CORS settings trong backend
- Kiểm tra file .env có đúng VITE_API_URL

### Token hết hạn
- Tự động refresh token nếu backend hỗ trợ
- Logout và login lại

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng kiểm tra:
1. Console log trong browser (F12)
2. Network tab để xem API requests
3. Backend logs
