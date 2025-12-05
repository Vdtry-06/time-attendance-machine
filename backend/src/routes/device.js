import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as deviceController from "../controllers/deviceController.js";
// import { authenticateToken } from "./../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
// router.use(authenticateToken);

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../uploads/'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'checkin-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// POST - CHECK-IN (Chấm công từ ESP32)
router.post('/checkin', upload.single('image'), deviceController.checkin);

// POST - ENROLL NOTIFICATION (Thông báo vân tay mới)
router.post('/enroll-notify', deviceController.enrollNotify);

// GET - DEVICE STATUS
router.get('/status', deviceController.getDeviceStatus);

export default router;