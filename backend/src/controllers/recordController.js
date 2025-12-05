import pool from "../db.js";

// Lấy danh sách records với filter và phân trang
export const getAllRecords = async (req, res) => {
    try {
        const { date, start_date, end_date, employee_id } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                r.id,
                r.time,
                r.device,
                r.imagePath,
                r.isCheckIn,
                r.note,
                e.id as employee_id,
                e.name as employee_name,
                e.position,
                u.username as user_name
            FROM Record r
            LEFT JOIN Employee e ON r.Employeeid = e.id
            LEFT JOIN User u ON r.Userid = u.id
            WHERE 1=1
        `;
        
        let countQuery = `
            SELECT COUNT(*) as total
            FROM Record r
            LEFT JOIN Employee e ON r.Employeeid = e.id
            LEFT JOIN User u ON r.Userid = u.id
            WHERE 1=1
        `;
        
        const params = [];
        
        // Filter by specific date
        if (date) {
            query += " AND DATE(r.time) = ?";
            countQuery += " AND DATE(r.time) = ?";
            params.push(date);
        }
        
        // Filter by date range
        if (start_date && end_date) {
            query += " AND DATE(r.time) BETWEEN ? AND ?";
            countQuery += " AND DATE(r.time) BETWEEN ? AND ?";
            params.push(start_date, end_date);
        }
        
        // Filter by employee
        if (employee_id) {
            query += " AND r.Employeeid = ?";
            countQuery += " AND r.Employeeid = ?";
            params.push(employee_id);
        }
        
        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;
        
        // Get paginated data
        query += " ORDER BY r.time DESC LIMIT ? OFFSET ?";
        const [rows] = await pool.query(query, [...params, limit, offset]);
        
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            status: "success",
            count: rows.length,
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

// Lấy records hôm nay
export const getTodayRecords = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // Get total count
        const [countResult] = await pool.query(
            "SELECT COUNT(*) as total FROM Record r WHERE DATE(r.time) = ?",
            [today]
        );
        const total = countResult[0].total;
        
        // Get paginated data
        const [rows] = await pool.query(`
            SELECT 
                r.id,
                r.time,
                r.device,
                r.imagePath,
                r.isCheckIn,
                r.note,
                e.id as employee_id,
                e.name as employee_name,
                e.position
            FROM Record r
            LEFT JOIN Employee e ON r.Employeeid = e.id
            WHERE DATE(r.time) = ?
            ORDER BY r.time DESC
            LIMIT ? OFFSET ?
        `, [today, limit, offset]);
        
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            status: "success",
            date: today,
            count: rows.length,
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

// Thống kê
export const getStatistics = async (req, res) => {
    try {
        const { month } = req.query;
        
        let dateFilter = "";
        const params = [];
        
        if (month) {
            dateFilter = "WHERE DATE_FORMAT(r.time, '%Y-%m') = ?";
            params.push(month);
        } else {
            const currentMonth = new Date().toISOString().slice(0, 7);
            dateFilter = "WHERE DATE_FORMAT(r.time, '%Y-%m') = ?";
            params.push(currentMonth);
        }
        
        // Total records
        const [totalRecords] = await pool.query(
            `SELECT COUNT(*) as total FROM Record r ${dateFilter}`,
            params
        );
        
        // Records by employee
        const [byEmployee] = await pool.query(`
            SELECT 
                e.id,
                e.name,
                COUNT(*) as total_records,
                SUM(CASE WHEN r.isCheckIn = 1 THEN 1 ELSE 0 END) as check_ins,
                SUM(CASE WHEN r.isCheckIn = 0 THEN 1 ELSE 0 END) as check_outs
            FROM Record r
            LEFT JOIN Employee e ON r.Employeeid = e.id
            ${dateFilter}
            GROUP BY e.id, e.name
            ORDER BY total_records DESC
        `, params);
        
        // Records by day
        const [byDay] = await pool.query(`
            SELECT 
                DATE(r.time) as date,
                COUNT(*) as total,
                SUM(CASE WHEN r.isCheckIn = 1 THEN 1 ELSE 0 END) as check_ins,
                SUM(CASE WHEN r.isCheckIn = 0 THEN 1 ELSE 0 END) as check_outs
            FROM Record r
            ${dateFilter}
            GROUP BY DATE(r.time)
            ORDER BY date DESC
        `, params);
        
        res.json({
            status: "success",
            period: month || new Date().toISOString().slice(0, 7),
            summary: {
                total_records: totalRecords[0].total,
                by_employee: byEmployee,
                by_day: byDay
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Chấm công thủ công
export const createManualRecord = async (req, res) => {
    try {
        const { employee_id, check_time, note, isCheckIn } = req.body;
        const user_id = req.user.id; // Lấy từ JWT token
        
        if (!employee_id || !check_time) {
            return res.status(400).json({
                status: "error",
                message: "employee_id and check_time are required"
            });
        }
        
        // Check if employee exists
        const [employee] = await pool.query(
            "SELECT * FROM Employee WHERE id = ?",
            [employee_id]
        );
        
        if (employee.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Employee not found"
            });
        }
        
        // Insert manual record
        const [result] = await pool.query(
            "INSERT INTO Record (Employeeid, Userid, time, note, isCheckIn, device) VALUES (?, ?, ?, ?, ?, ?)",
            [employee_id, user_id, check_time, note || 'Chấm công thủ công', isCheckIn !== undefined ? isCheckIn : 1, 'WEB_MANUAL']
        );
        
        res.status(201).json({
            status: "success",
            message: "Manual record created successfully",
            data: {
                id: result.insertId,
                employee_name: employee[0].name,
                time: check_time,
                created_by: req.user.username
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Xóa record
export const deleteRecord = async (req, res) => {
    try {
        const [existing] = await pool.query("SELECT * FROM Record WHERE id = ?", [req.params.id]);
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Record not found"
            });
        }
        
        await pool.query("DELETE FROM Record WHERE id = ?", [req.params.id]);
        
        res.json({
            status: "success",
            message: "Record deleted successfully"
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};