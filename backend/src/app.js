
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import employeeRoutes from "./routes/employee.js";
import recordRoutes from "./routes/record.js";
import deviceRoutes from "./routes/device.js";
import mqttService from "./services/mqttService.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// MQTT Setup
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://broker.hivemq.com:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";

mqttService.connect(MQTT_BROKER, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined
});

// MQTT Callbacks để xử lý message từ ESP32
mqttService.setEnrollResultCallback((deviceName, payload) => {
    console.log(`[APP] Enrollment result from ${deviceName}:`, payload);
    
    // TODO: Có thể emit qua WebSocket để real-time update cho Admin UI
    // io.emit('enrollment-result', { deviceName, ...payload });
});

mqttService.setHeartbeatCallback((deviceName, payload) => {
    console.log(`[APP] Heartbeat from ${deviceName}`);
    
    // TODO: Cập nhật trạng thái device vào database hoặc cache
});

// Test API
app.get("/", (req, res) => {
    res.json({ 
        status: "success",
        message: "IoT Fingerprint Backend Running...",
        version: "2.0.0 (MQTT)",
        mqtt: {
            connected: mqttService.isConnected,
            broker: MQTT_BROKER
        },
        endpoints: {
            auth: "/api/auth",
            employees: "/api/employees",
            records: "/api/records",
            device: "/api/device"
        }
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
    console.log(`MQTT Broker: ${MQTT_BROKER}`);
    console.log(`Uploads folder: ${path.join(__dirname, '../uploads')}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[SHUTDOWN] Disconnecting MQTT...');
    mqttService.disconnect();
    process.exit(0);
});
