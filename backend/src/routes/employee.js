import express from "express";
import * as employeeController from "../controllers/employeeController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticateToken);

// ========== EMPLOYEE CRUD ==========

/**
 * GET /api/employees
 * Lấy danh sách tất cả nhân viên (có phân trang)
 */
router.get("/", employeeController.getAllEmployees);

/**
 * GET /api/employees/search/:name
 * Tìm kiếm nhân viên theo tên
 */
router.get("/search/:name", employeeController.searchEmployees);

/**
 * GET /api/employees/:id
 * Lấy thông tin chi tiết 1 nhân viên
 */
router.get("/:id", employeeController.getEmployeeById);

/**
 * POST /api/employees
 * Tạo nhân viên mới (CHƯA CÓ FINGERPRINT)
 */
router.post("/", employeeController.createEmployee);

/**
 * PUT /api/employees/:id
 * Cập nhật thông tin nhân viên
 */
router.put("/:id", employeeController.updateEmployee);

/**
 * DELETE /api/employees/:id
 * Xóa nhân viên
 */
router.delete("/:id", employeeController.deleteEmployee);

// ========== FINGERPRINT ENROLLMENT (AUTO FLOW) ==========

/**
 * POST /api/employees/:id/enroll-fingerprint
 * Đăng ký vân tay tự động cho nhân viên
 * Body: { device_name: "ESP32-AS608-01" }
 * 
 * Flow:
 * 1. Backend gửi lệnh "enroll" qua MQTT
 * 2. ESP32 tự động tìm slot trống và đăng ký vân tay
 * 3. ESP32 gửi kết quả (employee_id, fingerprint_id) về
 * 4. Backend TỰ ĐỘNG gán fingerprint_id vào database
 */
router.post("/:id/enroll-fingerprint", employeeController.enrollFingerprint);

/**
 * GET /api/employees/:id/enrollment-status
 * Kiểm tra trạng thái đăng ký vân tay
 * 
 * Response:
 * - "pending": Đang chờ ESP32 scan vân tay
 * - "processing": Đã nhận fingerprint_id từ ESP32, đang cập nhật DB
 * - "completed": Đã hoàn tất, nhân viên đã có fingerprint_id
 */
router.get("/:id/enrollment-status", employeeController.getEnrollmentStatus);

export default router;