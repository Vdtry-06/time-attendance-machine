import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("JWT_SECRET:", process.env.JWT_SECRET);
        
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
        
        // So sánh password với bcrypt
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({
                status: "error",
                message: "Sai tên đăng nhập hoặc mật khẩu"
            });
        }
        
        // Tạo JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                position: user.position
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        // Tính thời gian hết hạn
        const decoded = jwt.decode(token);
        const expiresAt = new Date(decoded.exp * 1000);
        
        res.json({
            status: "success",
            message: "Login successful",
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    position: user.position
                },
                token: token,
                expiresAt: expiresAt.toISOString(),
                expiresIn: JWT_EXPIRES_IN
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const register = async (req, res) => {
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
        
        // Hash password với bcrypt (rounds = 7 để tương thích với Java BCrypt)
        const hashedPassword = await bcrypt.hash(password, 7);
        
        const [result] = await pool.query(
            "INSERT INTO User (username, password, position) VALUES (?, ?, ?)",
            [username, hashedPassword, position || 'Admin']
        );
        
        res.status(201).json({
            status: "success",
            message: "User registered successfully",
            data: {
                id: result.insertId,
                username,
                position: position || 'Admin'
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const getMe = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                status: "error",
                message: "No token provided"
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Lấy thông tin user từ database
        const [users] = await pool.query(
            "SELECT id, username, position FROM User WHERE id = ?",
            [decoded.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        }
        
        res.json({
            status: "success",
            data: users[0]
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: "error",
                message: "Token expired"
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: "error",
                message: "Invalid token"
            });
        }
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                status: "error",
                message: "No token provided"
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const { oldPassword, newPassword } = req.body;
        
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                status: "error",
                message: "Old password and new password are required"
            });
        }
        
        // Validate new password strength
        if (newPassword.length < 6) {
            return res.status(400).json({
                status: "error",
                message: "New password must be at least 6 characters"
            });
        }
        
        // Get current user
        const [users] = await pool.query(
            "SELECT * FROM User WHERE id = ?",
            [decoded.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        }
        
        const user = users[0];
        
        // Verify old password
        const isValidOldPassword = await bcrypt.compare(oldPassword, user.password);
        
        if (!isValidOldPassword) {
            return res.status(401).json({
                status: "error",
                message: "Old password is incorrect"
            });
        }
        
        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 7);
        
        // Update password
        await pool.query(
            "UPDATE User SET password = ? WHERE id = ?",
            [hashedNewPassword, decoded.id]
        );
        
        res.json({
            status: "success",
            message: "Password changed successfully"
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: "error",
                message: "Token expired"
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: "error",
                message: "Invalid token"
            });
        }
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const oldToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!oldToken) {
            return res.status(401).json({
                status: "error",
                message: "No token provided"
            });
        }
        
        // Verify old token (cho phép expired)
        const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
        
        // Tạo token mới
        const newToken = jwt.sign(
            { 
                id: decoded.id, 
                username: decoded.username,
                position: decoded.position
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        const newDecoded = jwt.decode(newToken);
        const expiresAt = new Date(newDecoded.exp * 1000);
        
        res.json({
            status: "success",
            message: "Token refreshed",
            data: {
                token: newToken,
                expiresAt: expiresAt.toISOString(),
                expiresIn: JWT_EXPIRES_IN
            }
        });
        
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: "error",
                message: "Invalid token"
            });
        }
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
};