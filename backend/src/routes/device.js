import express from "express";
import * as deviceController from "../controllers/deviceController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// ========== ESP32 DEVICE ROUTES (KHÔNG CẦN AUTH) ==========

/**
 * POST /api/device/checkin
 * Chấm công từ ESP32
 * Body: { fingerPrint: 5, device: "ESP32-AS608-01" }
 *    hoặc { fingerprint_id: 5, device_name: "ESP32-AS608-01", isCheckin: 1 }
 */
router.post('/checkin', deviceController.checkin);

/**
 * POST /api/device/enroll-notify
 * Legacy - Thông báo từ ESP32 khi có thay đổi vân tay
 * Body: { new_id: 5, device: "ESP32-AS608-01", action: "enroll|delete|delete_all" }
 */
router.post('/enroll-notify', deviceController.enrollNotify);

/**
 * POST/GET /api/device/status
 * Heartbeat từ ESP32 hoặc lấy danh sách devices
 * POST Body: { device, ip, rssi, fingerCount, freeHeap }
 * GET: Trả về danh sách devices và hoạt động
 */
router.post('/status', deviceController.deviceStatus);
router.get('/status', deviceController.deviceStatus);

// ========== ADMIN API ROUTES (CẦN JWT TOKEN) ==========

/**
 * POST /api/device/request-enroll
 * Admin yêu cầu ESP32 đăng ký vân tay qua MQTT
 * Body: { employee_id: 3, device_name: "ESP32-AS608-01" }
 */
router.post('/request-enroll', authenticateToken, deviceController.requestEnroll);

/**
 * POST /api/device/delete-fingerprint
 * Admin gửi lệnh xóa vân tay qua MQTT
 * Body: { device_name: "ESP32-AS608-01", fingerprint_id: 5 }
 */
router.post('/delete-fingerprint', authenticateToken, deviceController.deleteFingerprint);

/**
 * GET /api/device/employees/fingerprints
 * Lấy danh sách nhân viên có fingerprint
 */
router.get('/employees/fingerprints', authenticateToken, deviceController.getEmployeeFingerprints);

/**
 * POST /api/device/employees/assign-fingerprint
 * Gán fingerprint ID cho nhân viên
 * Body: { employeeId: 1, fingerPrint: 5 }
 */
router.post('/employees/assign-fingerprint', authenticateToken, deviceController.assignFingerprint);

/**
 * GET /api/device/attendance/history
 * Lấy lịch sử chấm công
 * Query: ?employeeId=1&startDate=2024-01-01&endDate=2024-12-31&limit=50
 */
router.get('/attendance/history', authenticateToken, deviceController.getAttendanceHistory);

export default router;