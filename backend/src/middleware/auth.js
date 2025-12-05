import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                status: "error",
                message: "Access token required"
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Lưu thông tin user vào request
        req.user = decoded;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: "error",
                message: "Token expired",
                code: "TOKEN_EXPIRED"
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: "error",
                message: "Invalid token"
            });
        }
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

// Middleware kiểm tra quyền Admin (optional)
export const requireAdmin = (req, res, next) => {
    if (req.user && req.user.position === 'Admin') {
        next();
    } else {
        res.status(403).json({
            status: "error",
            message: "Admin access required"
        });
    }
};