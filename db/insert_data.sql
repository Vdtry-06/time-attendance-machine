-- Thêm 1 Admin vào bảng User
INSERT INTO User (username, password, position) 
VALUES ('admin', '123456', 'System Administrator');

-- Thêm 2 Nhân viên vào bảng Employee
INSERT INTO Employee (name, position, identificationNum, email, phoneNum, fingerPrint) 
VALUES 
('Nguyen Van A', 'Developer', '0010990001', 'a.nguyen@example.com', '0901111111', 1),
('Tran Thi B', 'Tester', '0010990002', 'b.tran@example.com', '0902222222', 2);

-- Test Case 1: Chấm công tự động bằng máy (Userid là NULL)
INSERT INTO Record (Employeeid, device, imagePath, isCheckIn) 
VALUES (1, 'ESP32_Gate_1', '/uploads/img_001.jpg', 1);

-- Test Case 2: Chấm công bổ sung bởi Admin (Có Userid)
-- Admin (id=1) bổ sung chấm công cho Tran Thi B (id=2)
INSERT INTO Record (Employeeid, Userid, time, device, isCheckIn, note) 
VALUES (2, 1, '2025-12-05 08:30:00', 'WEB_APP', 1, 'Quên quét tay, bổ sung thủ công');