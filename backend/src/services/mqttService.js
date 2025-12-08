import mqtt from 'mqtt';
import pool from '../db.js';

class MQTTService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        
        // Cache kết quả enrollment tạm thời
        this.enrollmentResults = new Map();
        
        this.topics = {
            // Server -> ESP32
            DEVICE_COMMAND: 'iot/device/+/command',
            
            // ESP32 -> Server
            ENROLL_RESULT: 'iot/device/+/enroll/result',
            CHECKIN: 'iot/device/+/checkin',
            HEARTBEAT: 'iot/device/+/heartbeat',
            STATUS: 'iot/device/+/status'
        };
    }

    connect(brokerUrl, options = {}) {
        const defaultOptions = {
            clientId: `backend_${Math.random().toString(16).slice(3)}`,
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
            ...options
        };

        console.log(`[MQTT] Connecting to ${brokerUrl}...`);
        
        this.client = mqtt.connect(brokerUrl, defaultOptions);

        this.client.on('connect', () => {
            this.isConnected = true;
            console.log('[MQTT] ✓ Connected to broker');
            this.subscribeToTopics();
        });

        this.client.on('error', (error) => {
            console.error('[MQTT] ✗ Connection error:', error.message);
        });

        this.client.on('reconnect', () => {
            console.log('[MQTT] Reconnecting...');
        });

        this.client.on('offline', () => {
            this.isConnected = false;
            console.log('[MQTT] Offline');
        });

        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });
    }

    subscribeToTopics() {
        const subscribeTopics = [
            this.topics.ENROLL_RESULT,
            this.topics.HEARTBEAT,
            this.topics.STATUS
        ];

        subscribeTopics.forEach(topic => {
            this.client.subscribe(topic, (err) => {
                if (err) {
                    console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
                } else {
                    console.log(`[MQTT] ✓ Subscribed to ${topic}`);
                }
            });
        });
    }

    handleMessage(topic, message) {
        try {
            const payload = JSON.parse(message.toString());
            
            console.log(`[MQTT] Message received on ${topic}:`, payload);

            const deviceName = this.extractDeviceName(topic);

            if (topic.includes('/enroll/result')) {
                this.onEnrollResult(deviceName, payload);
            } else if (topic.includes('/heartbeat')) {
                this.onHeartbeat(deviceName, payload);
            } else if (topic.includes('/status')) {
                this.onStatus(deviceName, payload);
            }
        } catch (error) {
            console.error('[MQTT] Error parsing message:', error);
        }
    }

    extractDeviceName(topic) {
        const parts = topic.split('/');
        return parts[2] || 'unknown';
    }

    // Gửi lệnh chung đến ESP32
    sendCommand(deviceName, command) {
        if (!this.isConnected) {
            console.error('[MQTT] Not connected');
            return false;
        }

        const topic = `iot/device/${deviceName}/command`;
        const payload = JSON.stringify({
            ...command,
            timestamp: new Date().toISOString()
        });

        this.client.publish(topic, payload, { qos: 1 }, (err) => {
            if (err) {
                console.error(`[MQTT] Failed to send command to ${deviceName}:`, err);
            } else {
                console.log(`[MQTT] ✓ Command sent to ${deviceName}:`, command);
            }
        });

        return true;
    }

    // ========== XỬ LÝ KẾT QUẢ ENROLLMENT TỪ ESP32 ==========
    async onEnrollResult(deviceName, payload) {
        console.log(`[MQTT] ✓ Enrollment result from ${deviceName}:`, payload);
        
        const { employee_id, fingerprint_id, success, message } = payload;
        
        if (!employee_id || fingerprint_id === undefined) {
            console.error('[MQTT] Invalid enrollment result: missing employee_id or fingerprint_id');
            return;
        }
        
        // Lưu vào cache
        this.enrollmentResults.set(employee_id, {
            fingerprint_id,
            device_name: deviceName,
            success,
            message,
            timestamp: new Date().toISOString()
        });
        
        // Nếu thành công, TỰ ĐỘNG cập nhật database
        if (success && fingerprint_id >= 0) {
            try {
                // Kiểm tra fingerprint_id đã được dùng chưa
                const [existing] = await pool.query(
                    "SELECT * FROM Employee WHERE fingerPrint = ?",
                    [fingerprint_id]
                );
                
                if (existing.length > 0) {
                    console.error(`[MQTT] ✗ Fingerprint ID ${fingerprint_id} already assigned to ${existing[0].name}`);
                    return;
                }
                
                // Cập nhật fingerprint cho nhân viên
                await pool.query(
                    "UPDATE Employee SET fingerPrint = ? WHERE id = ?",
                    [fingerprint_id, employee_id]
                );
                
                console.log(`[MQTT] ✓✓ Auto-assigned fingerprint ${fingerprint_id} to employee ${employee_id}`);
                
                // Lấy thông tin nhân viên để log
                const [employee] = await pool.query(
                    "SELECT * FROM Employee WHERE id = ?",
                    [employee_id]
                );
                
                if (employee.length > 0) {
                    console.log(`[MQTT] ✓✓✓ Employee ${employee[0].name} now has fingerprint ID ${fingerprint_id}`);
                }
                
            } catch (error) {
                console.error('[MQTT] Error updating employee fingerprint:', error);
            }
        } else {
            console.error(`[MQTT] ✗ Enrollment failed for employee ${employee_id}: ${message}`);
        }
        
        // Gọi callback nếu có
        if (this.enrollResultCallback) {
            this.enrollResultCallback(deviceName, payload);
        }
    }

    onHeartbeat(deviceName, payload) {
        console.log(`[MQTT] Heartbeat from ${deviceName}:`, payload);
        
        if (this.heartbeatCallback) {
            this.heartbeatCallback(deviceName, payload);
        }
    }

    onStatus(deviceName, payload) {
        console.log(`[MQTT] Status from ${deviceName}:`, payload);
        
        if (this.statusCallback) {
            this.statusCallback(deviceName, payload);
        }
    }

    // ========== GETTERS ==========

    getEnrollmentResult(employeeId) {
        return this.enrollmentResults.get(employeeId) || null;
    }

    getAllEnrollmentResults() {
        return Array.from(this.enrollmentResults.entries()).map(([employee_id, data]) => ({
            employee_id,
            ...data
        }));
    }

    clearEnrollmentResult(employeeId) {
        return this.enrollmentResults.delete(employeeId);
    }

    // ========== SETTERS ==========

    setEnrollResultCallback(callback) {
        this.enrollResultCallback = callback;
    }

    setHeartbeatCallback(callback) {
        this.heartbeatCallback = callback;
    }

    setStatusCallback(callback) {
        this.statusCallback = callback;
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            console.log('[MQTT] Disconnected');
        }
    }
}

const mqttService = new MQTTService();
export default mqttService;