import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET all employees
router.get("/", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM Employee ORDER BY id DESC");
        res.json({
            status: "success",
            data: rows
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

// SEARCH employees by name
router.get("/search/:name", async (req, res) => {
    try {
        const searchTerm = `%${req.params.name}%`;
        const [rows] = await pool.query(
            "SELECT * FROM Employee WHERE name LIKE ? ORDER BY name",
            [searchTerm]
        );
        
        res.json({
            status: "success",
            count: rows.length,
            data: rows
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

        // Lấy field gửi từ client
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

        // Merge dữ liệu (ưu tiên cái được gửi)
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
            updated: updatedData
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