# Hệ Thống Chấm Công Vân Tay - Frontend

Ứng dụng React hiện đại để quản lý hệ thống chấm công vân tay.

## ✨ Tính năng

- 📊 **Dashboard**: Tổng quan thống kê và biểu đồ
- 👥 **Quản lý nhân viên**: CRUD nhân viên, đăng ký vân tay
- 🏢 **Quản lý phòng ban**: Tổ chức phòng ban
- ⏰ **Chấm công**: Theo dõi thời gian làm việc
- 📅 **Nghỉ phép**: Quản lý đơn xin nghỉ
- 📈 **Báo cáo**: Thống kê chi tiết và xuất Excel
- 🖐️ **Thiết bị**: Quản lý máy chấm công
- ⚙️ **Cài đặt**: Cấu hình hệ thống

## 🛠️ Công nghệ

- **React 18** - UI framework
- **Vite** - Build tool siêu nhanh
- **Tailwind CSS** - Styling hiện đại
- **React Router** - Navigation
- **React Query** - Data fetching
- **Axios** - HTTP client
- **Recharts** - Biểu đồ
- **Zustand** - State management
- **React Hot Toast** - Notifications
- **Lucide React** - Icons đẹp

## 🚀 Cài đặt

### Yêu cầu
- Node.js 16+
- npm hoặc yarn

### Các bước

1. **Cài đặt dependencies**
```bash
cd frontend
npm install
```

2. **Cấu hình môi trường**

Tạo file `.env` trong thư mục `frontend`:
```env
VITE_API_URL=http://localhost:5000/api
```

3. **Chạy development server**
```bash
npm run dev
```

Ứng dụng sẽ chạy tại: http://localhost:3000

4. **Build cho production**
```bash
npm run build
```

## 📁 Cấu trúc thư mục

```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # UI components (Button, Card, etc.)
│   │   └── layout/      # Layout components (Sidebar, Header)
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── store/           # Zustand stores
│   ├── utils/           # Utility functions
│   ├── App.jsx          # Main App component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html          # HTML template
├── vite.config.js      # Vite config
├── tailwind.config.js  # Tailwind config
└── package.json        # Dependencies
```

## 🎨 UI Components

### Button
```jsx
<Button variant="primary" size="md" icon={<Icon />}>
  Click me
</Button>
```

### Card
```jsx
<Card title="Title" subtitle="Subtitle">
  Content here
</Card>
```

### Input
```jsx
<Input
  label="Email"
  type="email"
  icon={<Mail />}
  value={value}
  onChange={handleChange}
/>
```

### Modal
```jsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  footer={<Button>Save</Button>}
>
  Content
</Modal>
```

### Table
```jsx
<Table
  columns={columns}
  data={data}
  loading={isLoading}
/>
```

## 🔌 API Integration

### Service Structure
```javascript
// services/index.js
export const employeeService = {
  getAll: (params) => apiClient.get('/employees', { params }),
  getById: (id) => apiClient.get(`/employees/${id}`),
  create: (data) => apiClient.post('/employees', data),
  update: (id, data) => apiClient.put(`/employees/${id}`, data),
  delete: (id) => apiClient.delete(`/employees/${id}`),
};
```

### Using React Query
```javascript
const { data, isLoading } = useQuery({
  queryKey: ['employees'],
  queryFn: () => employeeService.getAll(),
});
```

## 🎯 Features Chi tiết

### Dashboard
- Thống kê tổng quan (nhân viên, chấm công)
- Biểu đồ tuần/tháng
- Danh sách chấm công gần đây

### Quản lý Nhân viên
- Thêm/sửa/xóa nhân viên
- Đăng ký vân tay
- Tìm kiếm và lọc
- Quản lý thông tin chi tiết

### Chấm công
- Xem lịch sử chấm công
- Lọc theo ngày, phòng ban
- Tính giờ làm việc
- Trạng thái: Có mặt, Vắng, Muộn

### Báo cáo
- Thống kê theo phòng ban
- Biểu đồ phân tích
- Xuất Excel
- Top nhân viên xuất sắc

## 🔐 Authentication

```javascript
// Login
const { setAuth } = useAuthStore();
const response = await authService.login({ email, password });
setAuth(response.user, response.token);

// Logout
const { logout } = useAuthStore();
logout();
```

## 🎨 Styling

### Tailwind Classes
```css
/* Custom components */
.btn { /* Button styles */ }
.card { /* Card styles */ }
.input { /* Input styles */ }
.badge { /* Badge styles */ }
```

### Custom Colors
```javascript
// tailwind.config.js
colors: {
  primary: {
    50: '#eff6ff',
    // ... thêm các màu
  }
}
```

## 📱 Responsive

- Mobile-first design
- Sidebar thu gọn trên mobile
- Tables responsive
- Touch-friendly

## 🚀 Performance

- Code splitting với React Router
- Lazy loading components
- React Query caching
- Optimistic updates

## 🧪 Best Practices

- Component composition
- Custom hooks
- Error boundaries
- Loading states
- Toast notifications
- Form validation

## 📝 Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 🤝 API Endpoints

```
GET    /api/employees          # Danh sách nhân viên
POST   /api/employees          # Tạo nhân viên
PUT    /api/employees/:id      # Cập nhật
DELETE /api/employees/:id      # Xóa

GET    /api/attendance         # Lịch sử chấm công
POST   /api/attendance/check-in # Chấm công vào
POST   /api/attendance/check-out # Chấm công ra

GET    /api/reports/attendance # Báo cáo
GET    /api/reports/export     # Xuất Excel
```

## 🎓 Demo Account

```
Email: admin@example.com
Password: password
```

## 📄 License

MIT License

## 👨‍💻 Author

Your Name

---

**Happy Coding! 🚀**
