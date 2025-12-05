-- 2. Tạo bảng User (Admin/Người quản lý)
CREATE TABLE User (
    id INT(10) AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(250) NOT NULL UNIQUE, -- Tên đăng nhập không được trùng
    password VARCHAR(250) NOT NULL,        -- Lưu ý: Nên lưu mật khẩu đã mã hóa (bcrypt)
    position VARCHAR(500) DEFAULT NULL
);

-- 3. Tạo bảng Employee (Nhân viên chấm công)
CREATE TABLE Employee (
    id INT(10) AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    position VARCHAR(250) DEFAULT NULL,
    identificationNum VARCHAR(250) UNIQUE, -- CCCD/CMND không trùng
    email VARCHAR(250) UNIQUE,             -- Email không trùng
    phoneNum VARCHAR(250) UNIQUE,          -- SĐT không trùng
    fingerPrint INT(25) UNIQUE             -- ID vân tay (trả về từ AS608) không trùng
);

-- 4. Tạo bảng Record (Lịch sử chấm công)
CREATE TABLE Record (
    id INT(10) AUTO_INCREMENT PRIMARY KEY,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Tự động lấy giờ hiện tại nếu không truyền vào
    device VARCHAR(250) DEFAULT NULL,         -- Tên thiết bị (ESP32 hoặc Web)
    imagePath VARCHAR(500) DEFAULT NULL,      -- Đường dẫn ảnh (cho phép NULL)
    isCheckIn TINYINT(1) NOT NULL DEFAULT 1,  -- 1: Vào, 0: Ra. Dùng TINYINT tiết kiệm hơn INT
    note VARCHAR(500) DEFAULT NULL,           -- Ghi chú (cho phép NULL)
    
    -- Khóa ngoại
    Userid INT(10) DEFAULT NULL,              -- Cho phép NULL (nếu chấm bằng máy)
    Employeeid INT(10) NOT NULL,              -- Bắt buộc phải có nhân viên
    
    -- Thiết lập liên kết khóa ngoại
    CONSTRAINT fk_record_user 
        FOREIGN KEY (Userid) REFERENCES User(id) 
        ON DELETE SET NULL, -- Nếu xóa User Admin, giữ lại Record nhưng set Userid = NULL
        
    CONSTRAINT fk_record_employee 
        FOREIGN KEY (Employeeid) REFERENCES Employee(id) 
        ON DELETE CASCADE   -- Nếu xóa Nhân viên, xóa luôn toàn bộ lịch sử chấm công của họ
);