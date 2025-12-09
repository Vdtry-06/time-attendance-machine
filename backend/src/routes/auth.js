import express from "express";
import * as authController from "../controllers/authController.js";
// import authenticateToken  from "./../middleware/auth.js";

const router = express.Router();
// router.use(authenticateToken);

// POST - Login
router.post("/login", authController.login);

// POST - Register
router.post("/register", authController.register);

// GET - Get current user info
router.get("/me", authController.getMe);

// POST - Change password
router.post("/change-password", authController.changePassword);

// POST - Refresh token
router.post("/refresh", authController.refreshToken);

export default router;