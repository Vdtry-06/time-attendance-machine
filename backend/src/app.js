
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import employeeRoutes from "./routes/employee.js";
import recordRoutes from "./routes/record.js";
import deviceRoutes from "./routes/device.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Test API
app.get("/", (req, res) => {
    res.json({ 
        status: "success",
        message: "IoT Fingerprint Backend Running...",
        version: "1.0.0"
    });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/device", deviceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        status: "error",
        message: err.message || "Something went wrong!"
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        status: "error",
        message: "Route not found"
    });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API Base URL: http://localhost:${PORT}`);
    console.log(`Uploads folder: ${path.join(__dirname, '../uploads')}`);
});