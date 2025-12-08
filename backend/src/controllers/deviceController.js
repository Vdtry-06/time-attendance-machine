import pool from "../db.js";
import mqttService from "../services/mqttService.js";

/**
 * Check-in từ ESP32
 * POST /api/device/checkin
 * Body: { fingerprint_id: 2, device_name: "ESP32-AS608-01", isCheckin: 1 }
 */
export const checkin = async (req, res) => {
    try {
        const fingerId = req.body.fingerprint_id || req.body.fingerPrint;
        const deviceName = req.body.device_name || req.body.device || 'Unknown';
        const isCheckinFromDevice = req.body.isCheckin;
        
        console.log(`[CHECK-IN] Finger ID: ${fingerId}, Device: ${deviceName}, isCheckin: ${isCheckinFromDevice}`);
        
        if (!fingerId) {
            return res.status(400).json({
                status: "error",
                message: "fingerprint_id is required"
            });
        }
        
        const [employees] = await pool.query(
            "SELECT * FROM Employee WHERE fingerPrint = ?",
            [fingerId]
        );
        
        if (employees.length === 0) {
            return res.json({
                status: "fail",
                name: "Unregistered",
                message: "Vân tay chưa đăng ký trong hệ thống",
                fingerprint_id: fingerId
            });
        }
        
        const employee = employees[0];
        
        let isCheckIn = 1;
        
        if (isCheckinFromDevice !== undefined) {
            isCheckIn = isCheckinFromDevice;
        } else {
            const today = new Date().toISOString().split('T')[0];
            const [todayRecords] = await pool.query(
                "SELECT * FROM Record WHERE Employeeid = ? AND DATE(time) = ? ORDER BY time DESC LIMIT 1",
                [employee.id, today]
            );
            
            if (todayRecords.length > 0) {
                isCheckIn = todayRecords[0].isCheckIn === 1 ? 0 : 1;
            }
        }
        
        await pool.query(
            "INSERT INTO Record (Employeeid, time, device, imagePath, isCheckIn) VALUES (?, NOW(), ?, NULL, ?)",
            [employee.id, deviceName, isCheckIn]
        );
        
        res.json({
            status: "success",
            name: employee.name,
            position: employee.position,
            action: isCheckIn === 1 ? "Check-In" : "Check-Out",
            message: `Chấm công ${isCheckIn === 1 ? 'vào' : 'ra'} thành công`,
            time: new Date().toLocaleString('vi-VN'),
            employee_id: employee.id,
            isCheckin: isCheckIn
        });
        
        console.log(`✓ ${employee.name} - ${isCheckIn === 1 ? 'CHECK IN' : 'CHECK OUT'}`);
        
    } catch (error) {
        console.error('[CHECK-IN ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

/**
 * ADMIN API: Yêu cầu ESP32 đăng ký vân tay qua MQTT
 * POST /api/device/request-enroll
 * Body: { employee_id, device_name }
 */
export const requestEnroll = async (req, res) => {
    try {
        const { employee_id, device_name } = req.body;
        
        if (!employee_id || !device_name) {
            return res.status(400).json({
                status: "error",
                message: "employee_id and device_name are required"
            });
        }
        
        // Lấy thông tin nhân viên
        const [employees] = await pool.query(
            "SELECT * FROM Employee WHERE id = ?",
            [employee_id]
        );
        
        if (employees.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Employee not found"
            });
        }
        
        const employee = employees[0];
        
        if (!employee.fingerPrint) {
            return res.status(400).json({
                status: "error",
                message: "Employee does not have a fingerprint ID assigned"
            });
        }
        
        // Gửi lệnh qua MQTT
        const success = mqttService.sendEnrollRequest(device_name, {
            employee_id: employee.id,
            employee_name: employee.name,
            fingerprint_id: employee.fingerPrint
        });
        
        if (!success) {
            return res.status(503).json({
                status: "error",
                message: "MQTT service unavailable"
            });
        }
        
        res.json({
            status: "success",
            message: "Enrollment request sent via MQTT",
            employee: {
                id: employee.id,
                name: employee.name,
                fingerprint_id: employee.fingerPrint
            },
            device: device_name
        });
        
        console.log(`[REQUEST-ENROLL] Sent MQTT command for ${employee.name} (ID: ${employee.fingerPrint}) to ${device_name}`);
        
    } catch (error) {
        console.error('[REQUEST-ENROLL ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

/**
 * ADMIN API: Gửi lệnh xóa vân tay qua MQTT
 * POST /api/device/delete-fingerprint
 * Body: { device_name, fingerprint_id }
 */
export const deleteFingerprint = async (req, res) => {
    try {
        const { device_name, fingerprint_id } = req.body;
        
        if (!device_name || fingerprint_id === undefined) {
            return res.status(400).json({
                status: "error",
                message: "device_name and fingerprint_id are required"
            });
        }
        
        const success = mqttService.sendCommand(device_name, {
            action: 'delete',
            fingerprint_id: fingerprint_id
        });
        
        if (!success) {
            return res.status(503).json({
                status: "error",
                message: "MQTT service unavailable"
            });
        }
        
        res.json({
            status: "success",
            message: "Delete command sent via MQTT"
        });
        
    } catch (error) {
        console.error('[DELETE-FINGERPRINT ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

/**
 * Heartbeat từ ESP32 (HTTP fallback)
 * POST /api/device/status
 */
export const deviceStatus = async (req, res) => {
    try {
        const { device, ip, rssi, fingerCount, freeHeap } = req.body;
        
        if (device) {
            console.log(`[HEARTBEAT] ${device} - IP: ${ip}, RSSI: ${rssi}, Fingers: ${fingerCount}`);
            
            return res.json({
                status: "success",
                message: "Heartbeat received"
            });
        }
        
        const [records] = await pool.query(
            "SELECT device, COUNT(*) as count, MAX(time) as last_activity FROM Record GROUP BY device ORDER BY last_activity DESC"
        );
        
        res.json({
            status: "success",
            devices: records
        });
        
    } catch (error) {
        console.error('[DEVICE-STATUS ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

/**
 * Legacy support
 */
export const enrollNotify = async (req, res) => {
    try {
        const { new_id, device, action } = req.body;
        
        console.log(`[ENROLL-NOTIFY] Action: ${action}, ID: ${new_id}, Device: ${device}`);
        
        res.json({
            status: "success",
            message: "Notification received"
        });
        
    } catch (error) {
        console.error('[ENROLL-NOTIFY ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

/**
 * ADMIN API: Lấy danh sách nhân viên
 */
export const getEmployeeFingerprints = async (req, res) => {
    try {
        const [employees] = await pool.query(
            "SELECT id, name, position, fingerPrint FROM Employee WHERE fingerPrint IS NOT NULL ORDER BY name"
        );
        
        res.json({
            status: "success",
            count: employees.length,
            employees: employees
        });
        
    } catch (error) {
        console.error('[GET-EMPLOYEES ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

/**
 * ADMIN API: Gán fingerprint
 */
export const assignFingerprint = async (req, res) => {
    try {
        const { employeeId, fingerPrint } = req.body;
        
        if (!employeeId || fingerPrint === undefined) {
            return res.status(400).json({
                status: "error",
                message: "employeeId and fingerPrint are required"
            });
        }
        
        if (fingerPrint !== null) {
            const [existing] = await pool.query(
                "SELECT * FROM Employee WHERE fingerPrint = ? AND id != ?",
                [fingerPrint, employeeId]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({
                    status: "error",
                    message: "This fingerprint ID is already assigned",
                    assigned_to: existing[0].name
                });
            }
        }
        
        await pool.query(
            "UPDATE Employee SET fingerPrint = ? WHERE id = ?",
            [fingerPrint, employeeId]
        );
        
        const [updated] = await pool.query(
            "SELECT * FROM Employee WHERE id = ?",
            [employeeId]
        );
        
        res.json({
            status: "success",
            message: "Fingerprint assigned successfully",
            employee: updated[0]
        });
        
        console.log(`✓ Assigned fingerprint ${fingerPrint} to employee ${employeeId}`);
        
    } catch (error) {
        console.error('[ASSIGN-FINGERPRINT ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

/**
 * ADMIN API: Lịch sử chấm công
 */
export const getAttendanceHistory = async (req, res) => {
    try {
        const { employeeId, startDate, endDate, limit = 50 } = req.query;
        
        let query = `
            SELECT r.*, e.name, e.position, e.fingerPrint 
            FROM Record r 
            JOIN Employee e ON r.Employeeid = e.id 
            WHERE 1=1
        `;
        const params = [];
        
        if (employeeId) {
            query += " AND r.Employeeid = ?";
            params.push(employeeId);
        }
        
        if (startDate) {
            query += " AND DATE(r.time) >= ?";
            params.push(startDate);
        }
        
        if (endDate) {
            query += " AND DATE(r.time) <= ?";
            params.push(endDate);
        }
        
        query += " ORDER BY r.time DESC LIMIT ?";
        params.push(parseInt(limit));
        
        const [records] = await pool.query(query, params);
        
        res.json({
            status: "success",
            count: records.length,
            records: records
        });
        
    } catch (error) {
        console.error('[GET-HISTORY ERROR]:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};