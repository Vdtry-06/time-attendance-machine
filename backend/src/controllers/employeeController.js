import pool from "../db.js";
import mqttService from "../services/mqttService.js";

// Lấy danh sách nhân viên với phân trang
export const getAllEmployees = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        const [countResult] = await pool.query("SELECT COUNT(*) as total FROM Employee");
        const total = countResult[0].total;
        
        const [rows] = await pool.query(
            "SELECT * FROM Employee ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
        
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            status: "success",
            data: rows,
            pagination: {
                page: page,
                limit: limit,
                total: total,
                totalPages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const getEmployeeById = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM Employee WHERE id = ?", [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                status: "error", 
                message: "Employee not found" 
            });
        }
        
        res.json({
            status: "success",
            data: rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const searchEmployees = async (req, res) => {
    try {
        const searchTerm = `%${req.params.name}%`;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        const [countResult] = await pool.query(
            "SELECT COUNT(*) as total FROM Employee WHERE name LIKE ?",
            [searchTerm]
        );
        const total = countResult[0].total;
        
        const [rows] = await pool.query(
            "SELECT * FROM Employee WHERE name LIKE ? ORDER BY name LIMIT ? OFFSET ?",
            [searchTerm, limit, offset]
        );
        
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            status: "success",
            count: total,
            data: rows,
            pagination: {
                page: page,
                limit: limit,
                total: total,
                totalPages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Tạo nhân viên mới (KHÔNG CÓ FINGERPRINT)
export const createEmployee = async (req, res) => {
    try {
        const { name, position, identificationNum, email, phoneNum } = req.body;
        
        if (!name || !identificationNum) {
            return res.status(400).json({
                status: "error",
                message: "Name and identificationNum are required"
            });
        }
        
        const [existing] = await pool.query(
            "SELECT * FROM Employee WHERE identificationNum = ?",
            [identificationNum]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                status: "error",
                message: "CCCD đã tồn tại trong hệ thống"
            });
        }
        
        const [result] = await pool.query(
            "INSERT INTO Employee (name, position, identificationNum, email, phoneNum, fingerPrint) VALUES (?, ?, ?, ?, ?, NULL)",
            [name, position, identificationNum, email, phoneNum]
        );
        
        res.status(201).json({
            status: "success",
            message: "Employee created successfully. Please enroll fingerprint.",
            data: {
                id: result.insertId,
                name,
                position,
                identificationNum,
                email,
                phoneNum,
                fingerPrint: null
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ========== YÊU CẦU ESP32 ĐĂNG KÝ VÂN TAY ==========
/**
 * POST /api/employees/:id/enroll-fingerprint
 * Body: { device_name: "ESP32-AS608-01" }
 * 
 * Flow:
 * 1. Gửi lệnh đến ESP32
 * 2. ESP32 tự động tìm slot trống và đăng ký
 * 3. ESP32 trả về fingerprint_id qua MQTT
 * 4. Backend TỰ ĐỘNG gán fingerprint_id cho nhân viên
 */
export const enrollFingerprint = async (req, res) => {
    try {
        const employeeId = req.params.id;
        const { device_name } = req.body;
        
        if (!device_name) {
            return res.status(400).json({
                status: "error",
                message: "device_name is required"
            });
        }
        
        // Lấy thông tin nhân viên
        const [employees] = await pool.query(
            "SELECT * FROM Employee WHERE id = ?",
            [employeeId]
        );
        
        if (employees.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Employee not found"
            });
        }
        
        const employee = employees[0];
        
        // Kiểm tra nhân viên đã có fingerprint chưa
        if (employee.fingerPrint) {
            return res.status(400).json({
                status: "error",
                message: "Employee already has a fingerprint. Please delete it first.",
                current_fingerprint: employee.fingerPrint
            });
        }
        
        // Gửi lệnh qua MQTT
        const success = mqttService.sendCommand(device_name, {
            action: 'enroll',
            employee_id: employee.id,
            employee_name: employee.name
        });
        
        if (!success) {
            return res.status(503).json({
                status: "error",
                message: "MQTT service unavailable"
            });
        }
        
        res.json({
            status: "success",
            message: "Enrollment request sent. Please scan finger on device.",
            employee: {
                id: employee.id,
                name: employee.name
            },
            device: device_name,
            next_step: "Wait for ESP32 to scan fingerprint. Server will auto-assign fingerprint_id."
        });
        
        console.log(`[ENROLL] Request sent for employee ${employee.id} (${employee.name}) to ${device_name}`);
        
    } catch (error) {
        console.error('[ENROLL ERROR]:', error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ========== KIỂM TRA KẾT QUẢ ENROLLMENT ==========
/**
 * GET /api/employees/:id/enrollment-status
 * Kiểm tra xem nhân viên đã được gán fingerprint chưa
 */
export const getEnrollmentStatus = async (req, res) => {
    try {
        const employeeId = parseInt(req.params.id);
        
        // Kiểm tra trong database
        const [employees] = await pool.query(
            "SELECT id, name, fingerPrint FROM Employee WHERE id = ?",
            [employeeId]
        );
        
        if (employees.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Employee not found"
            });
        }
        
        const employee = employees[0];
        
        if (employee.fingerPrint !== null) {
            return res.json({
                status: "completed",
                message: "Fingerprint enrolled successfully",
                employee: {
                    id: employee.id,
                    name: employee.name,
                    fingerprint_id: employee.fingerPrint
                }
            });
        }
        
        // Kiểm tra trong MQTT cache (nếu có)
        const mqttResult = mqttService.getEnrollmentResult(employeeId);
        
        if (mqttResult && mqttResult.success) {
            return res.json({
                status: "processing",
                message: "Fingerprint received, updating database...",
                fingerprint_id: mqttResult.fingerprint_id
            });
        }
        
        return res.json({
            status: "pending",
            message: "Waiting for fingerprint enrollment",
            employee: {
                id: employee.id,
                name: employee.name
            }
        });
        
    } catch (error) {
        console.error('[GET-ENROLLMENT-STATUS ERROR]:', error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Cập nhật thông tin nhân viên
export const updateEmployee = async (req, res) => {
    try {
        const employeeId = req.params.id;
        const { name, position, identificationNum, email, phoneNum, fingerPrint } = req.body;

        const [existing] = await pool.query(
            "SELECT * FROM Employee WHERE id = ?",
            [employeeId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Employee not found"
            });
        }

        const old = existing[0];

        const updatedData = {
            name: name ?? old.name,
            position: position ?? old.position,
            identificationNum: identificationNum ?? old.identificationNum,
            email: email ?? old.email,
            phoneNum: phoneNum ?? old.phoneNum,
            fingerPrint: fingerPrint ?? old.fingerPrint
        };

        if (updatedData.identificationNum) {
            const [duplicate] = await pool.query(
                "SELECT * FROM Employee WHERE identificationNum = ? AND id != ?",
                [updatedData.identificationNum, employeeId]
            );

            if (duplicate.length > 0) {
                return res.status(409).json({
                    status: "error",
                    message: "CCCD đã tồn tại"
                });
            }
        }

        if (updatedData.fingerPrint) {
            const [duplicate] = await pool.query(
                "SELECT * FROM Employee WHERE fingerPrint = ? AND id != ?",
                [updatedData.fingerPrint, employeeId]
            );

            if (duplicate.length > 0) {
                return res.status(409).json({
                    status: "error",
                    message: "Fingerprint ID đã được sử dụng"
                });
            }
        }

        await pool.query(
            `UPDATE Employee 
             SET name=?, position=?, identificationNum=?, email=?, phoneNum=?, fingerPrint=? 
             WHERE id=?`,
            [
                updatedData.name,
                updatedData.position,
                updatedData.identificationNum,
                updatedData.email,
                updatedData.phoneNum,
                updatedData.fingerPrint,
                employeeId
            ]
        );

        res.json({
            status: "success",
            message: "Employee updated successfully",
            data: updatedData
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Xóa nhân viên
export const deleteEmployee = async (req, res) => {
    try {
        const [existing] = await pool.query("SELECT * FROM Employee WHERE id = ?", [req.params.id]);
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Employee not found"
            });
        }
        
        const [records] = await pool.query("SELECT COUNT(*) as count FROM Record WHERE Employeeid = ?", [req.params.id]);
        
        if (records[0].count > 0) {
            return res.status(409).json({
                status: "error",
                message: "Không thể xóa nhân viên đã có lịch sử chấm công"
            });
        }
        
        await pool.query("DELETE FROM Employee WHERE id = ?", [req.params.id]);
        
        res.json({
            status: "success",
            message: "Employee deleted successfully"
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};