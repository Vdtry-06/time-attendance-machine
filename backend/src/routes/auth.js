import express from "express";
import pool from "../db.js";
// Note: For production, use bcryptjs to hash passwords
// import bcrypt from "bcryptjs";

const router = express.Router();

// POST - Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                status: "error",
                message: "Username and password are required"
            });
        }
        
        // Find user
        const [users] = await pool.query(
            "SELECT * FROM User WHERE username = ?",
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                status: "error",
                message: "Sai tên đăng nhập hoặc mật khẩu"
            });
        }
        
        const user = users[0];
        
        // For development: simple password comparison
        // TODO: In production, use: bcrypt.compare(password, user.password)
        if (user.password !== password) {
            return res.status(401).json({
                status: "error",
                message: "Sai tên đăng nhập hoặc mật khẩu"
            });
        }
        
        // Successful login
        // TODO: In production, generate JWT token
        res.json({
            status: "success",
            message: "Login successful",
            data: {
                id: user.id,
                username: user.username,
                position: user.position
                // Don't send password to client!
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// POST - Register (Admin only - Optional)
router.post("/register", async (req, res) => {
    try {
        const { username, password, position } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                status: "error",
                message: "Username and password are required"
            });
        }
        
        // Check if username exists
        const [existing] = await pool.query(
            "SELECT * FROM User WHERE username = ?",
            [username]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                status: "error",
                message: "Username already exists"
            });
        }
        
        // TODO: Hash password with bcrypt
        // const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await pool.query(
            "INSERT INTO User (username, password, position) VALUES (?, ?, ?)",
            [username, password, position || 'Admin']
        );
        
        res.status(201).json({
            status: "success",
            message: "User registered successfully",
            data: {
                id: result.insertId,
                username,
                position
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// GET - Current user info (requires token in production)
router.get("/me", async (req, res) => {
    try {
        // TODO: Extract user ID from JWT token
        // For now, return dummy data
        res.json({
            status: "success",
            message: "This endpoint requires authentication middleware",
            data: null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

export default router;