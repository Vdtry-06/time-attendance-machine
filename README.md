# TimeKeeper - IoT Fingerprint Attendance System

## 📋 Mục Lục

- [Giới Thiệu](#giới-thiệu)
- [Kiến Trúc Hệ Thống](#kiến-trúc-hệ-thống)
- [Các Thành Phần Chính](#các-thành-phần-chính)
- [Luồng Hoạt Động](#luồng-hoạt-động)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [MQTT Topics](#mqtt-topics)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Frontend Guide](#frontend-guide)

---

## 🎯 Giới Thiệu

**TimeKeeper** là một hệ thống chấm công tự động sử dụng công nghệ vân tay (fingerprint) trên nền tảng IoT. Hệ thống tích hợp ESP32, cảm biến AS608, MQTT broker, và backend Node.js để cung cấp một giải pháp quản lý nhân sự toàn diện.

### Tính năng chính:

- ✅ Chấm công tự động bằng vân tay
- ✅ Đăng ký vân tay từ xa qua web
- ✅ Quản lý nhân viên và records
- ✅ Thống kê chấm công theo tháng/ngày
- ✅ Điều khiển thiết bị qua MQTT
- ✅ Xác thực JWT Token
- ✅ Dashboard Admin thực tế

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────┐
│                     TIMEKEEPER SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend (React/Vite)                                           │
│  ├── Login Page                                                 │
│  ├── Dashboard (Thống kê)                                       │
│  ├── Employees (Quản lý)                                        │
│  ├── Attendance (Chấm công)                                     │
│  └── Settings (Cấu hình)                                        │
│           ↓ (HTTP REST API)                                     │
│  Backend (Node.js + Express)                                    │
│  ├── Auth Controller                                            │
│  ├── Employee Controller                                        │
│  ├── Record Controller                                          │
│  └── Device Controller                                          │
│           ↓ (SQL Query)         ↑ (MQTT Publish)               │
│  ┌────────────────────────────────────────┐                    │
│  │         Database (MySQL)                │                    │
│  │  ├── Users                              │                    │
│  │  ├── Employees                          │                    │
│  │  └── Records                            │                    │
│  └────────────────────────────────────────┘                    │
│           ↓ (Subscribe MQTT)                                    │
│  MQTT Broker (Mosquitto)                                        │
│           ↓                                                     │
│  ESP32 + AS608 (IoT Device)                                    │
│  ├── Fingerprint Scan                                          │
│  ├── WiFi Connection                                           │
│  └── Relay Control                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Thành Phần:

1. **Frontend (React/Vite)**: Giao diện admin quản lý
2. **Backend (Node.js + Express)**: API server, xử lý logic
3. **MySQL Database**: Lưu trữ dữ liệu
4. **MQTT Broker (Mosquitto)**: Giao tiếp IoT
5. **ESP32 + AS608**: Thiết bị chấm công tự động

---

## 📱 Các Thành Phần Chính

### 1. Frontend (React + Vite + Tailwind CSS)

**Vị trí**: `frontend/`

**Công nghệ**:

- **React 18**: UI library
- **Vite**: Build tool (nhanh)
- **Tailwind CSS**: Styling
- **Axios**: HTTP client
- **Zustand**: State management

**Cấu trúc thư mục**:

```
frontend/
├── src/
│   ├── components/
│   │   ├── ProtectedRoute.jsx      # Route bảo vệ (auth check)
│   │   ├── layout/
│   │   │   ├── Header.jsx          # Header với user info
│   │   │   ├── Layout.jsx          # Main layout
│   │   │   └── Sidebar.jsx         # Navigation menu
│   │   └── ui/
│   │       ├── Badge.jsx           # Status badge
│   │       ├── Button.jsx          # Reusable button
│   │       ├── Card.jsx            # Card component
│   │       ├── Input.jsx           # Form input
│   │       ├── LoadingSpinner.jsx  # Loading state
│   │       ├── Modal.jsx           # Modal dialog
│   │       └── Table.jsx           # Data table
│   ├── pages/
│   │   ├── Login.jsx               # Đăng nhập
│   │   ├── Dashboard.jsx           # Thống kê tổng quát
│   │   ├── Employees.jsx           # Quản lý nhân viên
│   │   ├── Attendance.jsx          # Chấm công
│   │   └── Settings.jsx            # Cấu hình
│   ├── services/
│   │   ├── api.js                  # Axios instance + API calls
│   │   └── index.js                # Export services
│   ├── store/
│   │   └── authStore.js            # Zustand auth store
│   ├── utils/
│   │   ├── dateUtils.js            # Date helper functions
│   │   └── helpers.js              # Utility functions
│   ├── App.jsx                     # Root component
│   ├── main.jsx                    # Entry point
│   └── index.css                   # Global styles
├── Dockerfile                      # Docker config
├── nginx.conf                      # Nginx config (production)
├── vite.config.js                  # Vite config
├── tailwind.config.js              # Tailwind config
├── .env                            # Environment variables
└── package.json
```

**Pages & Features**:

#### **A. Login Page** (`pages/Login.jsx`)

- Form đăng nhập với username/password
- Xác thực qua API `/api/auth/login`
- Lưu JWT token vào localStorage
- Redirect đến Dashboard nếu thành công

```
┌─────────────────────────────────┐
│       LOGIN PAGE                │
├─────────────────────────────────┤
│                                 │
│  Logo: TimeKeeper               │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Username                │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Password                │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐  │
│  │ SIGN IN (Button)         │  │
│  └──────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

#### **B. Dashboard** (`pages/Dashboard.jsx`)

- **Thống kê hôm nay**: Tổng check-in, check-out, late arrivals
- **Biểu đồ**: Chấm công theo tuần/tháng
- **Bảng**: Top 10 nhân viên không có fingerprint
- **Status device**: Trạng thái ESP32 online/offline

```
┌──────────────────────────────────────────────┐
│        DASHBOARD                             │
├──────────────────────────────────────────────┤
│                                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Total Check │  │ Total Check │           │
│  │ In: 45      │  │ Out: 42     │           │
│  └─────────────┘  └─────────────┘           │
│                                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Late Arrival│  │ Absent      │           │
│  │ 3           │  │ 5           │           │
│  └─────────────┘  └─────────────┘           │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │ Attendance Chart (This Month)        │  │
│  │                                      │  │
│  │ [Line Chart / Bar Chart]            │  │
│  └──────────────────────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │ Device Status                        │  │
│  │ ESP32-AS608-01: ONLINE ✓             │  │
│  └──────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

#### **C. Employees** (`pages/Employees.jsx`)

- **Danh sách nhân viên** (phân trang)
- **Tìm kiếm** theo tên, ID
- **Thêm nhân viên** mới (modal form)
- **Chỉnh sửa** thông tin nhân viên
- **Xóa** nhân viên
- **Đăng ký vân tay** (enroll fingerprint button)
- **Xem trạng thái** enrollment

```
┌───────────────────────────────────────────────────┐
│            EMPLOYEES                              │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────────┐                              │
│  │ + Add Employee  │                              │
│  └─────────────────┘                              │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Search: [____________________]              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  │ ID │ Name │ Position │ Email │ Fingerprint│Actions│
│  ├────┼──────┼──────────┼───────┼──────────┼────────┤
│  │ 1  │ Nguyễn Văn A │ Dev  │ a@c.com │ ✓ 5  │ ✎ 🗑 │
│  │ 2  │ Trần Thị B │ HR   │ b@c.com │ ✗ -  │ ✎ 🗑 │
│  │ 3  │ Lê Minh C   │ QA   │ c@c.com │ ✓ 8  │ ✎ 🗑 │
│  │... │ ...        │ ...  │ ...     │ ...  │ ... │
│  └────┴───────────┴──────────┴──────┴──────┴─────┘ │
│                                                   │
│  Pagination: « 1 2 3 4 5 »                       │
└───────────────────────────────────────────────────┘
```

**Modal Thêm/Chỉnh Sửa Employee**:

```
┌──────────────────────────────────────┐
│ Add New Employee                     │
├──────────────────────────────────────┤
│ Name:        [________________]      │
│ Position:    [________________]      │
│ Email:       [________________]      │
│ Phone:       [________________]      │
│ Identification: [________________]   │
│                                      │
│ ┌─────────┐  ┌────────┐             │
│ │ Save    │  │ Cancel │             │
│ └─────────┘  └────────┘             │
└──────────────────────────────────────┘
```

#### **D. Attendance** (`pages/Attendance.jsx`)

- **Danh sách chấm công** (records)
- **Filter**: By date, employee, check-in/out
- **Phân trang**: 10 records/page
- **Export**: Download CSV (optional)
- **Thống kê**: Total, present, absent, late
- **Chấm công thủ công** (manual check-in/out)

```
┌──────────────────────────────────────────────────────┐
│         ATTENDANCE RECORDS                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Filter:                                             │
│ Date From: [__/___/____]  To: [__/___/____]        │
│ Employee: [Select Employee ▼]                      │
│ Type: [All ▼]  Status: [All ▼]                    │
│ [Search] [Reset]                                   │
│                                                      │
│ Stats: Total: 120 | Present: 115 | Absent: 5      │
│                                                      │
│ ┌────┬───────────┬──────────┬──────┬──────┬─────┐ │
│ │ ID │ Employee  │ Date     │ Time │ Type │Note │ │
│ ├────┼───────────┼──────────┼──────┼──────┼─────┤ │
│ │ 1  │ Nguyễn A  │ 01/12/24 │ 08:15│ IN   │     │ │
│ │ 2  │ Trần B    │ 01/12/24 │ 08:30│ IN   │Late │ │
│ │ 3  │ Nguyễn A  │ 01/12/24 │ 17:45│ OUT  │     │ │
│ │... │ ...       │ ...      │ ...  │ ...  │ ..  │ │
│ └────┴───────────┴──────────┴──────┴──────┴─────┘ │
│                                                      │
│ Pagination: « 1 2 3 4 5 »                          │
└──────────────────────────────────────────────────────┘
```

#### **E. Settings** (`pages/Settings.jsx`)

- **Thay đổi mật khẩu**
- **Quản lý device ESP32**: Tên, IP, status
- **Cấu hình MQTT** (optional): Broker URL, port
- **Thông tin hệ thống**: Version, API endpoint

```
┌───────────────────────────────────────┐
│        SETTINGS                       │
├───────────────────────────────────────┤
│                                       │
│ 1. Change Password                    │
│ ┌──────────────────────────────────┐ │
│ │ Current Password: [____________] │ │
│ │ New Password:     [____________] │ │
│ │ Confirm Password: [____________] │ │
│ │ ┌──────┐  ┌────────┐             │ │
│ │ │ Save │  │ Cancel │             │ │
│ │ └──────┘  └────────┘             │ │
│ └──────────────────────────────────┘ │
│                                       │
│ 2. Device Configuration               │
│ Device Name: [________________]       │
│ Device IP:   [________________]       │
│ Status: ONLINE ✓                     │
│                                       │
│ 3. System Information                 │
│ API Version: v1.0                     │
│ Frontend Version: v1.0                │
│ Build Date: 2024-01-01               │
│                                       │
└───────────────────────────────────────┘
```

---

### 2. ESP32 Firmware

**Vị trí**: `esp32_firmware/esp32_firmware.ino`

**Chức năng**:

- Quét vân tay (AS608 sensor)
- Kết nối WiFi & MQTT
- Điều khiển relay (GPIO4)
- Hiển thị LCD status

**Luồng hoạt động**:

```
┌─────────────────────────────────────────────────────┐
│              SETUP                                  │
│ - Khởi tạo WiFi                                     │
│ - Khởi tạo MQTT broker                              │
│ - Relay OFF (chờ lệnh bật)                          │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│         LOOP - CHỜ LỆNH MQTT                        │
│ Topic: iot/device/ESP32-AS608-01/command            │
└────────────────┬────────────────────────────────────┘
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
   [Power ON]      [Power OFF]
   Bật AS608+      Tắt AS608+
   LCD             LCD
        │                 │
        └────────┬────────┘
                 ↓
    ┌────────────────────────────────────────┐
    │   ACTIVE MODE - Quét & Chấm Công      │
    │                                        │
    │  1. Quét vân tay (getFingerprintID)   │
    │  2. Gửi HTTP POST /api/device/checkin │
    │  3. Nhận phản hồi từ server            │
    │  4. Hiển thị LCD + relay sound         │
    │                                        │
    │  5. Gửi MQTT Heartbeat mỗi 60s        │
    └────────────────────────────────────────┘
        ↓
    [Đăng Ký Vân Tay]
    1. Nhận lệnh action="enroll" qua MQTT
    2. Tìm slot trống (1-127)
    3. Quét 2 lần cùng vân tay
    4. Lưu vào AS608
    5. Gửi kết quả qua MQTT topic:
       iot/device/ESP32-AS608-01/enroll/result
```

---

### 3. MQTT Broker (Mosquitto)

**Vị trí**: `mosquitto/`

**Vai trò**:

- Nhận/gửi message giữa ESP32 và Backend
- Port 1883: MQTT protocol
- Port 9001: WebSocket (optional)
- Anonymous: Không cần username/password

**Cấu trúc thư mục**:

```
mosquitto/
├── config/
│   └── mosquitto.conf          # File cấu hình
├── data/                        # Lưu data
└── log/                         # Lưu log
```

---

### 4. Backend Server (Node.js + Express)

**Vị trí**: `backend/src/app.js`

**Các route API chính**:

#### **A. Authentication** (`/api/auth`)

```js
POST   /api/auth/login           → Đăng nhập (JWT token)
POST   /api/auth/register        → Tạo admin account
POST   /api/auth/change-password → Đổi mật khẩu
POST   /api/auth/refresh         → Refresh token
GET    /api/auth/me              → Lấy info user hiện tại
```

#### **B. Quản Lý Nhân Viên** (`/api/employees`)

```js
GET    /api/employees                    → Danh sách nhân viên (phân trang)
GET    /api/employees/:id                → Chi tiết 1 nhân viên
POST   /api/employees                    → Tạo nhân viên mới (CHƯA có fingerprint)
PUT    /api/employees/:id                → Cập nhật info
DELETE /api/employees/:id                → Xóa nhân viên

// Đăng ký vân tay tự động
POST   /api/employees/:id/enroll-fingerprint  → Gửi lệnh enroll qua MQTT
GET    /api/employees/:id/enrollment-status  → Kiểm tra trạng thái enrollment
```

#### **C. Chấm Công** (`/api/records`)

```js
GET    /api/records           → Lấy tất cả records (có filter & phân trang)
GET    /api/records/today     → Records hôm nay
GET    /api/records/statistics → Thống kê (theo tháng, nhân viên, ngày)
POST   /api/records/manual    → Chấm công thủ công (Admin)
DELETE /api/records/:id       → Xóa record
```

#### **D. Thiết Bị IoT** (`/api/device`)

**Từ ESP32 (không cần auth)**:

```js
POST /api/device/checkin                  ← ESP32 gửi khi quét vân tay
POST /api/device/power-status-report      ← ESP32 báo cáo trạng thái nguồn
POST /api/device/status                   ← Heartbeat từ ESP32
```

**Admin API (cần JWT token)**:

```js
POST /api/device/power-on                 → Bật nguồn
POST /api/device/power-off                → Tắt nguồn
POST /api/device/request-enroll           → Yêu cầu enroll (cũ, dùng em)
POST /api/device/delete-fingerprint       → Xóa vân tay
GET  /api/device/employees/fingerprints   → Danh sách nhân viên + fingerprint
```

---

## 🔄 Luồng Hoạt Động

### Luồng 1: Chấm Công (Check-in)

```
ESP32                          Backend              Database
  │                              │                    │
  ├─ Quét vân tay                │                    │
  │  (fingerprintID = 5)          │                    │
  │                               │                    │
  ├─ HTTP POST /api/device/checkin
  │  Body: {                      │                    │
  │    fingerprint_id: 5,         │                    │
  │    device_name: "ESP32-...",  │                    │
  │    isCheckin: 1               │                    │
  │  }                            │                    │
  │                              ├─ Tìm Employee      │
  │                              │  WHERE fingerPrint=5│
  │                              │                    ├─ Trả về: {id:1, name:"Nguyen Van A"}
  │                              │◄──────────────────┤
  │                              │                    │
  │                              ├─ Thêm Record       │
  │                              │  (Employeeid=1,    │
  │                              │   time=NOW(),      │
  │                              │   isCheckIn=1)     │
  │                              │                    ├─ INSERT OK
  │                              │◄──────────────────┤
  │◄─────── Response ────────────┤                    │
  │  {                            │                    │
  │    status: "success",         │                    │
  │    name: "Nguyen Van A",      │                    │
  │    action: "Check-In"         │                    │
  │  }                            │                    │
  │                               │                    │
  ├─ Hiển thị LCD                │                    │
  │  "Nguyen Van A"               │                    │
  │  "Check-In"                   │                    │
  │                               │                    │
```

### Luồng 2: Đăng Ký Vân Tay (Enrollment)

```
Admin (Web UI)                 Backend              MQTT           ESP32
   │                             │                  │               │
   ├─ Form: Chọn nhân viên       │                  │               │
   │  (ID=2, Name="Tran Thi B")  │                  │               │
   │                             │                  │               │
   ├─ POST /api/employees/2/enroll-fingerprint
   │  Body: {device_name: "ESP32-AS608-01"}        │               │
   │                            ├─ Send MQTT       │               │
   │                            │  Command:        ├─ topic:       │
   │                            │  {                │ /command      ├─ Receive
   │                            │    action: "enroll",             │
   │                            │    employee_id: 2,              │
   │                            │    employee_name: "Tran Thi B"   │
   │                            │  }               │               │
   │◄─ Response ────────────────┤                  │               │
   │  {status: "pending"}        │                  │               ├─ Tìm slot trống
   │                             │                  │               │  (ví dụ: slot 8)
   │                             │                  │               │
   │  (Admin chờ & monitor...)   │                  │               ├─ Chụp ảnh 1
   │                             │                  │               │  (Place finger...)
   │                             │                  │               │
   │                             │                  │               ├─ Chụp ảnh 2
   │                             │                  │               │  (Remove & place again)
   │                             │                  │               │
   │                             │                  │               ├─ Tạo model
   │                             │                  │               │
   │                             │                  │               ├─ Lưu vào slot 8
   │                             │                  │               │
   │                             │                  │  Publish      │
   │                             │◄──────────────────────────────┤
   │                             │  topic: /enroll/result
   │                             │  {
   │                             │    employee_id: 2,
   │                             │    fingerprint_id: 8,
   │                             │    success: true
   │                             │  }
   │                             │
   │                             ├─ UPDATE Employee
   │                             │  SET fingerPrint=8
   │                             │  WHERE id=2
   │                             │                ├─ Update OK
   │                             │◄───────────────┤
   │                             │
   ├─ GET /api/employees/2/enrollment-status
   │  (hoặc polling client)      │
   │◄─ Response ─────────────────┤
   │  {
   │    status: "completed",
   │    fingerprint_id: 8
   │  }
```

### Luồng 3: Authentication Flow

```
Admin                          Backend
  │                              │
  ├─ POST /api/auth/login
  │  {username: "admin",         │
  │   password: "123456"}        │
  │                             ├─ Hash password với bcrypt
  │                             │  (compare với DB)
  │                             │
  │                             ├─ Tạo JWT token
  │                             │  {id, username, position}
  │                             │  exp: 1h
  │◄─ Response ─────────────────┤
  │  {                           │
  │    token: "eyJhbG...",      │
  │    expiresAt: "2024-01-01T10:00:00Z"
  │  }                           │
  │                              │
  ├─ Lưu token vào localStorage
  │                              │
  ├─ GET /api/records
  │  Header: Authorization: Bearer eyJhbG...
  │                             ├─ Verify JWT
  │                             │  (check exp & signature)
  │                             │
  │                             ├─ Attach user info → req.user
  │                             │
  │                             ├─ Xử lý request & return data
  │◄─ Response ─────────────────┤
```

---

## 💾 Database Schema

```sql
User                    Employee              Record
├─ id (PK)             ├─ id (PK)            ├─ id (PK)
├─ username            ├─ name               ├─ time (TIMESTAMP)
├─ password (bcrypt)   ├─ position           ├─ device
└─ position            ├─ identificationNum  ├─ imagePath
                       ├─ email              ├─ isCheckIn (1=vào, 0=ra)
                       ├─ phoneNum           ├─ note
                       └─ fingerPrint (FK)   ├─ Userid (FK → User)
                                             └─ Employeeid (FK → Employee)
```

**Mô tả chi tiết**:

| Bảng         | Cột               | Kiểu         | Mô Tả                           |
| ------------ | ----------------- | ------------ | ------------------------------- |
| **User**     | id                | INT PK       | ID người dùng                   |
|              | username          | VARCHAR(50)  | Tên đăng nhập                   |
|              | password          | VARCHAR(255) | Hash password (bcrypt)          |
|              | position          | VARCHAR(100) | Chức vụ                         |
| **Employee** | id                | INT PK       | ID nhân viên                    |
|              | name              | VARCHAR(100) | Tên nhân viên                   |
|              | position          | VARCHAR(100) | Chức vụ                         |
|              | identificationNum | VARCHAR(20)  | Số CMND/CCCD                    |
|              | email             | VARCHAR(100) | Email                           |
|              | phoneNum          | VARCHAR(20)  | Số điện thoại                   |
|              | fingerPrint       | INT          | Slot vân tay trên AS608 (1-127) |
| **Record**   | id                | INT PK       | ID record                       |
|              | time              | TIMESTAMP    | Thời gian chấm công             |
|              | device            | VARCHAR(100) | Tên thiết bị                    |
|              | imagePath         | VARCHAR(255) | Đường dẫn ảnh (optional)        |
|              | isCheckIn         | TINYINT      | 1 = Check-in, 0 = Check-out     |
|              | note              | TEXT         | Ghi chú                         |
|              | Userid            | INT FK       | Reference User.id               |
|              | Employeeid        | INT FK       | Reference Employee.id           |

---

## 📡 MQTT Topics

### Từ ESP32 → Backend

| Topic                                     | Nội Dung                         | Ví Dụ                                                |
| ----------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| `iot/device/ESP32-AS608-01/status`        | Heartbeat: IP, RSSI, fingerCount | `{ip: "192.168.1.100", rssi: -50, count: 15}`        |
| `iot/device/ESP32-AS608-01/power/status`  | Trạng thái nguồn                 | `{status: true}`                                     |
| `iot/device/ESP32-AS608-01/enroll/result` | Kết quả đăng ký vân tay          | `{employee_id: 2, fingerprint_id: 8, success: true}` |

### Từ Backend → ESP32

| Topic                                 | Nội Dung        | Ví Dụ                                                            |
| ------------------------------------- | --------------- | ---------------------------------------------------------------- |
| `iot/device/ESP32-AS608-01/command`   | Lệnh điều khiển | `{action: "power_on"}` hoặc `{action: "enroll", employee_id: 2}` |
| `iot/device/ESP32-AS608-01/power/on`  | Bật nguồn       | `{command: "on"}`                                                |
| `iot/device/ESP32-AS608-01/power/off` | Tắt nguồn       | `{command: "off"}`                                               |

---

## 🚀 Cài Đặt & Chạy

### Yêu Cầu:

- Docker & Docker Compose
- Node.js 14+ (nếu chạy local)
- MySQL 5.7+ (nếu chạy local)
- ESP32 board + AS608 sensor

### 1. Clone Repository

```bash
git clone <repository-url>
cd timekeeper
```

### 2. Chạy với Docker Compose

```bash
docker-compose up -d
```

Điều này sẽ khởi động các service:

- **frontend** (React UI): `localhost:3000` hoặc `localhost:5173`
- **backend** (API): `localhost:8080`
- **mosquitto** (MQTT): `localhost:1883`
- **mysql** (Database): `localhost:3306`

### 3. Khởi Tạo Database

```bash
docker exec timekeeper-mysql mysql -u root -p123456 < db/init.sql
docker exec timekeeper-mysql mysql -u root -p123456 timekeeper < db/insert_data.sql
```

### 4. Truy Cập Frontend

```
http://localhost:3000
```

**Tài khoản mặc định**:

- Username: `admin`
- Password: `123456`

### 5. Test API

```bash
# Đăng nhập
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# Lấy danh sách nhân viên
curl -X GET http://localhost:8080/api/employees \
  -H "Authorization: Bearer <token>"
```

### 6. Cấu Hình ESP32

1. Mở `esp32_firmware/esp32_firmware.ino` trong Arduino IDE
2. Cập nhật WiFi SSID & Password
3. Cập nhật MQTT Broker IP (`mqtt_server = "192.168.1.100"`)
4. Upload code lên ESP32

---

## 🎨 Frontend Guide

### Setup Frontend (Local Development)

**Chạy frontend riêng lẻ**:

```bash
cd frontend
npm install
npm run dev
```

Sẽ chạy ở `http://localhost:5173`

### Cấu Hình API Backend

**File**: `frontend/.env`

```env
VITE_API_URL=http://localhost:8080
VITE_API_TIMEOUT=10000
```

hoặc chỉnh sửa trong `frontend/src/services/api.js`:

```javascript
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
```

### Frontend Architecture

**State Management** (`src/store/authStore.js`):

```javascript
// Zustand store
const authStore = create((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  login: async (username, password) => {
    // Call /api/auth/login
    // Save token to localStorage
    // Set user state
  },
  logout: () => {
    // Clear token
    // Clear user state
  },
  isAuthenticated: !!token,
}));
```

**API Service** (`src/services/api.js`):

```javascript
// Axios instance with interceptors
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
});

// Add token to every request
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (Unauthorized)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

**Protected Routes** (`src/components/ProtectedRoute.jsx`):

```javascript
// Check if user is authenticated
// If not, redirect to /login
// Otherwise, render component
```

**Reusable Components** (`src/components/ui/`):

- `Button.jsx`: Reusable button with variants
- `Input.jsx`: Form input with validation
- `Modal.jsx`: Modal dialog
- `Table.jsx`: Data table with pagination
- `Card.jsx`: Card container
- `Badge.jsx`: Status badge
- `LoadingSpinner.jsx`: Loading state

### Build & Deployment

**Build for production**:

```bash
cd frontend
npm run build
```

**Output**: `frontend/dist/` folder

**Serve with Nginx** (production):

```bash
docker build -t timekeeper-frontend .
docker run -p 80:80 timekeeper-frontend
```

**Dockerfile** (`frontend/Dockerfile`):

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 📊 Tóm tắt Luồng Dữ Liệu

| Hành động                   | Từ       | Đến        | Qua                          |
| --------------------------- | -------- | ---------- | ---------------------------- |
| **Quét vân tay**            | ESP32    | Backend    | HTTP POST                    |
| **Chấm công**               | Backend  | MySQL      | SQL INSERT                   |
| **Yêu cầu enroll**          | Backend  | ESP32      | MQTT Command                 |
| **Kết quả enroll**          | ESP32    | Backend    | MQTT Topic                   |
| **Cập nhật fingerprint**    | Backend  | MySQL      | SQL UPDATE                   |
| **Lấy danh sách chấm công** | Frontend | Backend    | HTTP GET                     |
| **Đăng nhập**               | Frontend | Backend    | HTTP POST                    |
| **Xác thực**                | Backend  | JWT Secret | Token Verify                 |
| **Hiển thị dashboard**      | Frontend | Backend    | HTTP GET (polling/real-time) |

---

## 📁 Cấu Trúc Thư Mục Toàn Bộ

```
timekeeper/
├── frontend/                        # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Layout.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   └── ui/
│   │   │       ├── Badge.jsx
│   │   │       ├── Button.jsx
│   │   │       ├── Card.jsx
│   │   │       ├── Input.jsx
│   │   │       ├── LoadingSpinner.jsx
│   │   │       ├── Modal.jsx
│   │   │       ├── Table.jsx
│   │   │       └── index.js
│   │   ├── pages/
│   │   │   ├── Attendance.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Employees.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── index.js
│   │   ├── store/
│   │   │   └── authStore.js
│   │   ├── utils/
│   │   │   ├── dateUtils.js
│   │   │   └── helpers.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env
│
├── backend/                         # Backend Node.js
│   ├── src/
│   │   ├── app.js
│   │   ├── db.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── deviceController.js
│   │   │   ├── employeeController.js
│   │   │   └── recordController.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── device.js
│   │   │   ├── employee.js
│   │   │   └── record.js
│   │   ├── services/
│   │   │   └── mqttService.js
│   │   └── utils/
│   │       └── bcrypt-test.js
│   ├── Dockerfile
│   ├── package.json
│   └── .env
│
├── mosquitto/                       # MQTT Broker
│   ├── config/
│   │   └── mosquitto.conf
│   ├── data/
│   └── log/
│
├── db/                              # Database Scripts
│   ├── init.sql
│   └── insert_data.sql
│
├── esp32_firmware/                  # ESP32 Code
│   └── esp32_firmware.ino
│
├── docker-compose.yml               # Docker Compose Config
└── README.md                        # This file
```

---

## 🔧 Biến Môi Trường

### Backend (.env)

```env
# Database
DB_HOST=mysql
DB_USER=root
DB_PASSWORD=123456
DB_NAME=timekeeper
DB_PORT=3306

# JWT
JWT_SECRET=
JWT_EXPIRE=1h

# MQTT
MQTT_BROKER=mqtt://mosquitto:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Server
PORT=8080
NODE_ENV=production
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8080
VITE_API_TIMEOUT=10000
```

---

## 📝 Ghi Chú

- Hệ thống sử dụng **JWT token** với thời hạn 1 giờ
- Password được mã hóa bằng **bcrypt**
- MQTT broker chạy ở chế độ **anonymous** (không cần password)
- Database tự động khởi tạo từ `db/init.sql`
- Frontend sử dụng **Tailwind CSS** cho styling
- State management dùng **Zustand** (lightweight)

---

## 👨‍💻 Hỗ Trợ

Nếu có vấn đề, vui lòng kiểm tra:

- **Frontend logs**: Browser console (`F12`)
- **Backend logs**: `docker-compose logs backend`
- **MQTT logs**: `docker-compose logs mosquitto`
- **Database logs**: `docker-compose logs mysql`
- **Network**: Đảm bảo firewall cho phép các port 3000, 8080, 1883

---

## 📚 Tài Liệu Bổ Sung

- Frontend Setup: [`frontend/SETUP.md`](frontend/SETUP.md)
- Frontend Docker: [`frontend/README-DOCKER.md`](frontend/README-DOCKER.md)
- Backend API: Xem swagger hoặc Postman collection
