import express from "express";
import pool from "../db.js";
import { authenticateToken } from "../middleware/auth.js"; 

const router = express.Router();
router.use(authenticateToken);

// GET all employees with pagination
router.get("/", async (req, res) => {
    try {
        // Lấy parameters phân trang từ query string
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Lấy tổng số records
        const [countResult] = await pool.query("SELECT COUNT(*) as total FROM Employee");
        const total = countResult[0].total;
        
        // Lấy dữ liệu với phân trang
        const [rows] = await pool.query(
            "SELECT * FROM Employee ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
        
        // Tính toán thông tin phân trang
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
});

// GET employee by ID
router.get("/:id", async (req, res) => {
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
});

// SEARCH employees by name with pagination
router.get("/search/:name", async (req, res) => {
    try {
        const searchTerm = `%${req.params.name}%`;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Đếm tổng số kết quả tìm kiếm
        const [countResult] = await pool.query(
            "SELECT COUNT(*) as total FROM Employee WHERE name LIKE ?",
            [searchTerm]
        );
        const total = countResult[0].total;
        
        // Lấy dữ liệu với phân trang
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
});

// POST - Create new employee
router.post("/", async (req, res) => {
    try {
        const { name, position, identificationNum, email, phoneNum, fingerPrint } = req.body;
        
        // Validate required fields
        if (!name || !identificationNum) {
            return res.status(400).json({
                status: "error",
                message: "Name and identificationNum are required"
            });
        }
        
        // Check if identificationNum already exists
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
        
        // Check if fingerPrint ID is already used
        if (fingerPrint) {
            const [existingFinger] = await pool.query(
                "SELECT * FROM Employee WHERE fingerPrint = ?",
                [fingerPrint]
            );
            
            if (existingFinger.length > 0) {
                return res.status(409).json({
                    status: "error",
                    message: "Fingerprint ID đã được sử dụng"
                });
            }
        }
        
        const [result] = await pool.query(
            "INSERT INTO Employee (name, position, identificationNum, email, phoneNum, fingerPrint) VALUES (?, ?, ?, ?, ?, ?)",
            [name, position, identificationNum, email, phoneNum, fingerPrint || null]
        );
        
        res.status(201).json({
            status: "success",
            message: "Employee created successfully",
            data: {
                id: result.insertId,
                name,
                position,
                identificationNum,
                email,
                phoneNum,
                fingerPrint
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// PUT - Update employee
router.put("/:id", async (req, res) => {
    try {
        const employeeId = req.params.id;
        const { name, position, identificationNum, email, phoneNum, fingerPrint } = req.body;

        // Lấy dữ liệu cũ
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

        // Merge dữ liệu
        const updatedData = {
            name: name ?? old.name,
            position: position ?? old.position,
            identificationNum: identificationNum ?? old.identificationNum,
            email: email ?? old.email,
            phoneNum: phoneNum ?? old.phoneNum,
            fingerPrint: fingerPrint ?? old.fingerPrint
        };

        // Kiểm tra trùng CCCD
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

        // Kiểm tra trùng fingerprint
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

        // Update
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
});

// DELETE employee
router.delete("/:id", async (req, res) => {
    try {
        const [existing] = await pool.query("SELECT * FROM Employee WHERE id = ?", [req.params.id]);
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Employee not found"
            });
        }
        
        // Check if employee has records
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
});

export default router;