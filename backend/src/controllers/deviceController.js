import pool from "../db.js";

// Check-in từ ESP32
export const checkin = async (req, res) => {
    try {
        const fingerId = req.body.fingerPrint;
        const deviceName = req.body.device || 'Unknown';
        
        // Get image path
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
        
        console.log(`[CHECK-IN] Finger ID: ${fingerId}, Device: ${deviceName}`);
        
        if (!fingerId) {
            return res.status(400).json({
                status: "error",
                message: "fingerPrint is required"
            });
        }
        
        // Find employee by fingerprint ID
        const [employees] = await pool.query(
            "SELECT * FROM Employee WHERE fingerPrint = ?",
            [fingerId]
        );
        
        if (employees.length === 0) {
            return res.json({
                status: "fail",
                name: "Unregistered",
                message: "Vân tay chưa đăng ký trong hệ thống"
            });
        }
        
        const employee = employees[0];
        
        // Check if already checked in today
        const today = new Date().toISOString().split('T')[0];
        const [todayRecords] = await pool.query(
            "SELECT * FROM Record WHERE Employeeid = ? AND DATE(time) = ? ORDER BY time DESC LIMIT 1",
            [employee.id, today]
        );
        
        // Determine check-in or check-out
        let isCheckIn = 1;
        if (todayRecords.length > 0) {
            isCheckIn = todayRecords[0].isCheckIn === 1 ? 0 : 1;
        }
        
        // Insert record
        await pool.query(
            "INSERT INTO Record (Employeeid, time, device, imagePath, isCheckIn) VALUES (?, NOW(), ?, ?, ?)",
            [employee.id, deviceName, imagePath, isCheckIn]
        );
        
        // Return success response to ESP32
        res.json({
            status: "success",
            name: employee.name,
            position: employee.position,
            action: isCheckIn === 1 ? "CHECK_IN" : "CHECK_OUT",
            message: `Chấm công ${isCheckIn === 1 ? 'vào' : 'ra'} thành công`,
            time: new Date().toLocaleString('vi-VN')
        });
        
    } catch (error) {
        console.error('[CHECK-IN ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

// Thông báo vân tay mới từ ESP32
export const enrollNotify = async (req, res) => {
    try {
        const { new_id, device } = req.body;
        
        console.log(`[ENROLL] New fingerprint ID: ${new_id}, Device: ${device}`);
        
        if (!new_id) {
            return res.status(400).json({
                status: "error",
                message: "new_id is required"
            });
        }
        
        // Check if this fingerprint ID already exists
        const [existing] = await pool.query(
            "SELECT * FROM Employee WHERE fingerPrint = ?",
            [new_id]
        );
        
        if (existing.length > 0) {
            return res.json({
                status: "warning",
                message: "Fingerprint ID already registered",
                employee: existing[0]
            });
        }
        
        // TODO: Add notification logic here
        // For example: send to admin dashboard via WebSocket
        
        res.json({
            status: "success",
            message: "New fingerprint ID ready for assignment",
            finger_id: new_id,
            next_step: "Admin needs to assign this ID to an employee"
        });
        
    } catch (error) {
        console.error('[ENROLL ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

// Lấy trạng thái thiết bị
export const getDeviceStatus = async (req, res) => {
    try {
        // Get last records to determine device activity
        const [records] = await pool.query(
            "SELECT device, COUNT(*) as count, MAX(time) as last_activity FROM Record GROUP BY device ORDER BY last_activity DESC"
        );
        
        res.json({
            status: "success",
            devices: records
        });
        
    } catch (error) {
        console.error('[STATUS ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};