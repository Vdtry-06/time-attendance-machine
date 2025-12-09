import express from "express";
import { authenticateToken } from "../middleware/auth.js";  
import * as recordController from "../controllers/recordController.js";

const router = express.Router();
router.use(authenticateToken);

// GET all records with optional date filter and pagination
router.get("/", recordController.getAllRecords);

// GET today's records with pagination
router.get("/today", recordController.getTodayRecords);

// GET statistics
router.get("/statistics", recordController.getStatistics);

// POST - Manual check-in (Admin adds record manually)
router.post("/manual", recordController.createManualRecord);

// DELETE record (Admin only)
router.delete("/:id", recordController.deleteRecord);

export default router;