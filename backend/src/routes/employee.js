import express from "express";
import { authenticateToken } from "../middleware/auth.js"; 
import * as employeeController from "../controllers/employeeController.js";

const router = express.Router();
router.use(authenticateToken);

// GET all employees with pagination
router.get("/", employeeController.getAllEmployees);

// GET employee by ID
router.get("/:id", employeeController.getEmployeeById);

// SEARCH employees by name
router.get("/search/:name", employeeController.searchEmployees);

// POST - Create new employee
router.post("/", employeeController.createEmployee);

// PUT - Update employee
router.put("/:id", employeeController.updateEmployee);

// DELETE employee
router.delete("/:id", employeeController.deleteEmployee);

export default router;