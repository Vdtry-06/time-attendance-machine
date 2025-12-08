#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>

// ========== CẤU HÌNH ==========
// WiFi
const char* ssid = "iPhone của tui";
const char* password = "66668888";

// Backend Server (HTTP cho checkin)
const char* SERVER_URL = "https://7dt1dz37-8080.asse.devtunnels.ms";
const char* DEVICE_NAME = "ESP32-AS608-01";

// MQTT Broker
const char* MQTT_BROKER = "broker.hivemq.com";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "";
const char* MQTT_PASS = "";

// MQTT Topics
String TOPIC_COMMAND = String("iot/device/") + DEVICE_NAME + "/command";
String TOPIC_ENROLL_RESULT = String("iot/device/") + DEVICE_NAME + "/enroll/result";
String TOPIC_HEARTBEAT = String("iot/device/") + DEVICE_NAME + "/heartbeat";

// Hardware
HardwareSerial mySerial(1);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// MQTT Client
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Biến trạng thái
bool hasLCD = false;
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 60000;

// Attendance management
struct AttendanceRecord {
  int fingerID;
  int isCheckin;
  unsigned long lastCheckTime;
};

AttendanceRecord attendanceLog[127];
int currentDay = 0;

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n=== ESP32 AS608 Attendance System (Auto-Enroll) ===");

  // Khởi động LCD
  Wire.begin(1, 2);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Starting...");
  hasLCD = true;

  // Khởi động AS608
  mySerial.begin(57600, SERIAL_8N1, 42, 41);
  
  if (finger.verifyPassword()) {
    Serial.println("✓ AS608 Connected!");
    if (hasLCD) {
      lcd.clear();
      lcd.print("AS608: OK");
    }
  } else {
    Serial.println("AS608 Not Found!");
    if (hasLCD) {
      lcd.clear();
      lcd.print("AS608: ERROR!");
    }
    while (1) { delay(1); }
  }

  // Kết nối WiFi
  connectWiFi();

  // Kết nối MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();

  // Hiển thị thông tin
  finger.getTemplateCount();
  Serial.print("Fingerprints: ");
  Serial.println(finger.templateCount);
  
  if (hasLCD) {
    delay(2000);
    lcd.clear();
    lcd.print("Ready!");
    lcd.setCursor(0, 1);
    lcd.print("Fingers: ");
    lcd.print(finger.templateCount);
    delay(2000);
  }

  resetAttendanceLog();
  displayReady();
}

void loop() {
  // Reconnect nếu mất kết nối
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  
  mqttClient.loop();
  
  checkAndResetDaily();
  
  // Heartbeat qua MQTT
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Quét vân tay để chấm công
  int fingerId = getFingerprintID();
  
  if (fingerId >= 0) {
    handleCheckin(fingerId);
  }
  
  delay(50);
}

// ========== WIFI FUNCTIONS ==========
// Kết nối đến mạng WiFi – retry tối đa 20 lần.
// Hiển thị trạng thái lên LCD và Serial.
void connectWiFi() {
  Serial.print("Connecting WiFi");
  if (hasLCD) {
    lcd.clear();
    lcd.print("WiFi Connect...");
  }
  
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("WiFi: OK");
      lcd.setCursor(0, 1);
      lcd.print(WiFi.localIP());
      delay(2000);
    }
  } else {
    Serial.println("\nWiFi Failed!");
    if (hasLCD) {
      lcd.clear();
      lcd.print("WiFi: FAILED");
    }
  }
}

// ========== MQTT FUNCTIONS ==========
// Kết nối đến MQTT Broker HiveMQ.
// Tự tạo clientId ngẫu nhiên.
// Sau khi kết nối thì subscribe vào topic điều khiển của thiết bị.
void connectMQTT() {
  Serial.print("Connecting MQTT...");
  
  String clientId = String("ESP32-") + String(random(0xffff), HEX);
  
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println(" Connected!");
    
    // Subscribe to command topic only
    mqttClient.subscribe(TOPIC_COMMAND.c_str());
    
    Serial.println("✓ Subscribed to:");
    Serial.println("  - " + TOPIC_COMMAND);
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("MQTT: OK");
      delay(1000);
    }
  } else {
    Serial.print(" Failed, rc=");
    Serial.println(mqttClient.state());
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("MQTT: FAIL");
      lcd.setCursor(0, 1);
      lcd.print("Code: ");
      lcd.print(mqttClient.state());
    }
  }
}

// Hàm này được gọi khi MQTT nhận được tin nhắn.
// Parse JSON và xử lý lệnh từ server.
// Hỗ trợ:
//   - action = "enroll"  → tự động lưu vân tay mới
//   - action = "delete"  → xóa vân tay theo ID
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("[MQTT] Message on ");
  Serial.print(topic);
  Serial.print(": ");
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // Parse JSON
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Handle commands
  if (String(topic) == TOPIC_COMMAND) {
    const char* action = doc["action"];
    
    // ========== AUTO ENROLL ==========
    if (strcmp(action, "enroll") == 0) {
      int employeeId = doc["employee_id"];
      const char* employeeName = doc["employee_name"];
      
      Serial.print("\n[MQTT CMD] Auto-enroll for Employee ID: ");
      Serial.print(employeeId);
      Serial.print(", Name: ");
      Serial.println(employeeName);
      
      // Tìm slot trống và đăng ký
      performAutoEnrollment(employeeId, employeeName);
    }
    
    // ========== DELETE ==========
    else if (strcmp(action, "delete") == 0) {
      int fingerId = doc["fingerprint_id"];
      Serial.print("[MQTT CMD] Delete fingerprint ID: ");
      Serial.println(fingerId);
      
      uint8_t p = finger.deleteModel(fingerId);
      if (p == FINGERPRINT_OK) {
        Serial.println("✓ Deleted successfully");
        if (hasLCD) {
          lcd.clear();
          lcd.print("Deleted ID:");
          lcd.print(fingerId);
          delay(2000);
          displayReady();
        }
      }
    }
  }
}

// Gửi gói tin heartbeat mỗi 60s lên MQTT.
// Gửi: IP, RSSI, số mẫu vân tay, free heap.
// Giúp server theo dõi tình trạng thiết bị.
void sendHeartbeat() {
  if (!mqttClient.connected()) return;
  
  finger.getTemplateCount();
  
  StaticJsonDocument<256> doc;
  doc["device"] = DEVICE_NAME;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["fingerCount"] = finger.templateCount;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  mqttClient.publish(TOPIC_HEARTBEAT.c_str(), payload.c_str());
  Serial.println("[MQTT] Heartbeat sent");
}

// ========== FINGERPRINT FUNCTIONS ==========
// Chụp ảnh vân tay → chuyển đổi → tìm kiếm trong bộ nhớ AS608.
// Nếu tìm thấy trả về ID, ngược lại trả về -1.
int getFingerprintID() {
  uint8_t p = finger.getImage();
  
  if (p != FINGERPRINT_OK) return -1;
  
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;
  
  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK) {
    if (hasLCD) {
      lcd.clear();
      lcd.print("Not Found!");
      delay(1500);
      displayReady();
    }
    return -1;
  }
  
  return finger.fingerID;
}

// Xử lý chấm công khi phát hiện vân tay.
// 1. Xác định Check-in hay Check-out.
// 2. Hiển thị lên LCD.
// 3. Gửi HTTP POST lên server /api/device/checkin.
// 4. Server trả về tên nhân viên → hiển thị thành công.
// 5. Lưu trạng thái để lần sau sẽ đảo (checkin ↔ checkout).
void handleCheckin(int fingerId) {
  Serial.print("\n[CHECKIN] Finger ID: ");
  Serial.println(fingerId);
  
  int isCheckin = getIsCheckin(fingerId);
  String checkType = (isCheckin == 1) ? "Check-In" : "Check-Out";
  
  if (hasLCD) {
    lcd.clear();
    lcd.print("ID: ");
    lcd.print(fingerId);
    lcd.setCursor(0, 1);
    lcd.print(checkType);
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected!");
    if (hasLCD) {
      lcd.clear();
      lcd.print("WiFi Error!");
      delay(2000);
      displayReady();
    }
    return;
  }
  
  // Gửi HTTP request
  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/checkin";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["fingerprint_id"] = fingerId;
  doc["isCheckin"] = isCheckin;
  doc["device_name"] = DEVICE_NAME;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  Serial.println("Sending: " + requestBody);
  
  int httpCode = http.POST(requestBody);
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Response: " + response);
    
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error) {
      const char* status = responseDoc["status"];
      const char* name = responseDoc["name"];

      if (hasLCD) {
        lcd.clear();
        
        if (strcmp(status, "success") == 0) {
          lcd.print(name);
          lcd.setCursor(0, 1);
          lcd.print(checkType);
        } else {
          lcd.print("Unregistered");
          lcd.setCursor(0, 1);
          lcd.print("ID: ");
          lcd.print(fingerId);
        }
        
        delay(3000);
        displayReady();
      }
      
      toggleCheckin(fingerId);
    }
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(httpCode);
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("Server Error!");
      delay(2000);
      displayReady();
    }
  }
  
  http.end();
}

// ========== AUTO ENROLLMENT FUNCTIONS ==========
// Tìm vị trí trống trong bộ nhớ AS608 (1–127).
// loadModel(i) → nếu thất bại nghĩa là slot trống.
// Trả về slot trống đầu tiên hoặc -1 nếu đầy.
int findEmptySlot() {
  Serial.println("FINDING EMPTY SLOT");
  
  // Lấy số lượng templates hiện tại
  finger.getTemplateCount();
  Serial.print("Current fingerprints: ");
  Serial.println(finger.templateCount);
  Serial.print("Max capacity: 127\n");
  
  if (finger.templateCount >= 127) {
    Serial.println("DATABASE FULL! Cannot add more fingerprints.");
    return -1;
  }
  
  // Tìm slot trống
  Serial.println("\nScanning slots 1-127...");
  
  for (int i = 1; i <= 127; i++) {
    // In progress mỗi 10 slot
    if (i % 10 == 0) {
      Serial.print("   Checking slot ");
      Serial.print(i);
      Serial.println("...");
    }
    
    // Thử load model từ slot i
    uint8_t p = finger.loadModel(i);
    
    // QUAN TRỌNG: Nếu loadModel KHÔNG trả về OK, nghĩa là slot trống!
    if (p != FINGERPRINT_OK) {
      Serial.println("\n");
      Serial.print("FOUND EMPTY SLOT: ");
      if (i < 10) Serial.print("  ");
      else if (i < 100) Serial.print(" ");
      Serial.print(i);
      
      if (hasLCD) {
        lcd.clear();
        lcd.print("Empty Slot: ");
        lcd.print(i);
        delay(1000);
      }
      
      return i;
    }
    
    // Nếu p == FINGERPRINT_OK, slot này ĐÃ CÓ vân tay
  }
  
  Serial.println("\nNO EMPTY SLOT FOUND!");
  Serial.println("   All 127 slots are occupied.");
  return -1;
}

// Quy trình auto enroll:
// 1. Nhận yêu cầu từ MQTT (employee_id + name).
// 2. Tìm slot trống trong AS608.
// 3. Gọi hàm enrollFingerprint() để thực hiện lưu vân tay.
// 4. Gửi kết quả đăng ký ngược lại MQTT.
void performAutoEnrollment(int employeeId, const char* employeeName) {
  Serial.println("AUTO ENROLLMENT STARTED");
  Serial.print("Employee ID: ");
  Serial.println(employeeId);
  Serial.print("Employee Name: ");
  Serial.println(employeeName);
  
  if (hasLCD) {
    lcd.clear();
    lcd.print("Enrolling:");
    lcd.setCursor(0, 1);
    lcd.print(employeeName);
    delay(2000);
  }
  
  // Tìm slot trống
  int fingerprintId = findEmptySlot();
  
  if (fingerprintId == -1) {
    Serial.println("\nENROLLMENT FAILED: No empty slot");
    sendEnrollResult(employeeId, -1, false, "No empty slot available");
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("Memory Full!");
      lcd.setCursor(0, 1);
      lcd.print("Cannot Enroll");
      delay(3000);
      displayReady();
    }
    return;
  }
  
  Serial.print("\nWill use slot: ");
  Serial.println(fingerprintId);
  
  // Bắt đầu enrollment
  Serial.println("SCANNING FINGERPRINT");
  
  bool success = enrollFingerprint(fingerprintId, employeeName);
  
  if (success) {
    Serial.println("ENROLLMENT SUCCESS!");
    Serial.print("Employee: ");
    Serial.println(employeeName);
    Serial.print("Assigned ID: ");
    Serial.println(fingerprintId);
    
    sendEnrollResult(employeeId, fingerprintId, true, "Enrollment successful");
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("Success!");
      lcd.setCursor(0, 1);
      lcd.print("ID: ");
      lcd.print(fingerprintId);
      delay(3000);
    }
  } else {
    Serial.println("ENROLLMENT FAILED!");
    
    sendEnrollResult(employeeId, fingerprintId, false, "Enrollment failed");
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("Failed!");
      lcd.setCursor(0, 1);
      lcd.print("Try Again");
      delay(3000);
    }
  }
  
  displayReady();
}

// Quy trình lấy vân tay 2 lần để tạo mẫu:
// 1. Yêu cầu đặt ngón tay → chụp ảnh → chuyển đổi image2Tz(1)
// 2. Yêu cầu NHẢ tay
// 3. Đặt lại cùng ngón tay → image2Tz(2)
// 4. Tạo model từ 2 lần quét
// 5. Lưu model vào slot ID
// Trả về true/false tùy thành công.
bool enrollFingerprint(int id, const char* name) {
  // Bước 1: Lấy ảnh lần 1
  if (hasLCD) {
    lcd.clear();
    lcd.print("Place finger...");
  }
  
  Serial.println("\nStep 1: Place your finger on the sensor");
  Serial.println("   Waiting for finger...");
  
  int p = -1;
  int timeout = 0;
  while (p != FINGERPRINT_OK && timeout < 200) {
    p = finger.getImage();
    
    if (timeout % 20 == 0 && timeout > 0) {
      Serial.print("   Still waiting... (");
      Serial.print(timeout / 10);
      Serial.println("s)");
    }
    
    delay(100);
    timeout++;
  }
  
  if (timeout >= 200) {
    Serial.println("TIMEOUT: No finger detected!");
    if (hasLCD) {
      lcd.clear();
      lcd.print("Timeout!");
      lcd.setCursor(0, 1);
      lcd.print("No finger");
      delay(2000);
    }
    return false;
  }
  
  Serial.println("Finger detected!");
  
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.println("ERROR: Failed to convert image 1");
    return false;
  }
  
  Serial.println("Image 1 captured and converted!");
  
  if (hasLCD) {
    lcd.clear();
    lcd.print("Image 1 OK!");
    lcd.setCursor(0, 1);
    lcd.print("Remove finger");
  }
  
  delay(2000);
  
  // Chờ nhả tay
  Serial.println("\nPlease remove your finger...");
  p = 0;
  timeout = 0;
  while (p != FINGERPRINT_NOFINGER && timeout < 50) {
    p = finger.getImage();
    delay(100);
    timeout++;
  }
  
  if (p == FINGERPRINT_NOFINGER) {
    Serial.println("Finger removed");
  }
  
  // Bước 2: Lấy ảnh lần 2
  if (hasLCD) {
    lcd.clear();
    lcd.print("Place same");
    lcd.setCursor(0, 1);
    lcd.print("finger again...");
  }
  
  Serial.println("\nStep 2: Place the SAME finger again");
  Serial.println("   Waiting for finger...");
  
  p = -1;
  timeout = 0;
  while (p != FINGERPRINT_OK && timeout < 200) {
    p = finger.getImage();
    
    if (timeout % 20 == 0 && timeout > 0) {
      Serial.print("   Still waiting... (");
      Serial.print(timeout / 10);
      Serial.println("s)");
    }
    
    delay(100);
    timeout++;
  }
  
  if (timeout >= 200) {
    Serial.println("TIMEOUT: No finger detected on second attempt!");
    if (hasLCD) {
      lcd.clear();
      lcd.print("Timeout!");
      delay(2000);
    }
    return false;
  }
  
  Serial.println("Finger detected!");
  
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println("ERROR: Failed to convert image 2");
    return false;
  }
  
  Serial.println("Image 2 captured and converted!");
  
  if (hasLCD) {
    lcd.clear();
    lcd.print("Image 2 OK!");
    lcd.setCursor(0, 1);
    lcd.print("Processing...");
  }
  
  // Tạo model
  Serial.println("\nCreating fingerprint model...");
  p = finger.createModel();
  
  if (p != FINGERPRINT_OK) {
    Serial.println("ERROR: Fingerprints do not match!");
    Serial.println("   Please try again with the same finger.");
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("Mismatch!");
      lcd.setCursor(0, 1);
      lcd.print("Try Again");
      delay(2000);
    }
    return false;
  }
  
  Serial.println("Model created successfully!");
  
  // Lưu vào bộ nhớ
  Serial.print("\nSaving to slot ");
  Serial.print(id);
  Serial.println("...");
  
  p = finger.storeModel(id);
  
  if (p == FINGERPRINT_OK) {
    Serial.println("Successfully saved!");
    return true;
  } else {
    Serial.print("Storage error, code: ");
    Serial.println(p);
    return false;
  }
}

void sendEnrollResult(int employeeId, int fingerprintId, bool success, const char* message) {
  if (!mqttClient.connected()) {
    Serial.println("MQTT not connected, cannot send result");
    return;
  }
  
  finger.getTemplateCount();
  
  StaticJsonDocument<512> doc;
  doc["employee_id"] = employeeId;
  doc["fingerprint_id"] = fingerprintId;
  doc["success"] = success;
  doc["message"] = message;
  doc["device_name"] = DEVICE_NAME;
  doc["total_fingerprints"] = finger.templateCount;
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.print("\n[MQTT] Sending enroll result: ");
  Serial.println(payload);
  
  bool published = mqttClient.publish(TOPIC_ENROLL_RESULT.c_str(), payload.c_str());
  
  if (published) {
    Serial.println("[MQTT] Result sent successfully");
  } else {
    Serial.println("[MQTT] Failed to send result");
  }
}

// ========== ATTENDANCE LOG MANAGEMENT ==========
// Reset dữ liệu chấm công trong RAM cho toàn bộ 127 ID.
// Dùng để hạn chế check-in lặp lại nhiều lần.
void resetAttendanceLog() {
  for (int i = 0; i < 127; i++) {
    attendanceLog[i].fingerID = -1;
    attendanceLog[i].isCheckin = 1;
    attendanceLog[i].lastCheckTime = 0;
  }
  Serial.println("Attendance log reset");
}

// Kiểm tra xem ID này tiếp theo là check-in hay check-out.
// Trả về 1 (check-in) hoặc 0 (check-out).
int getIsCheckin(int fingerID) {
  for (int i = 0; i < 127; i++) {
    if (attendanceLog[i].fingerID == fingerID) {
      return attendanceLog[i].isCheckin;
    }
  }
  return 1;
}

// Sau khi chấm công thành công thì đảo trạng thái:
// check-in → check-out → check-in → ...
void toggleCheckin(int fingerID) {
  for (int i = 0; i < 127; i++) {
    if (attendanceLog[i].fingerID == fingerID) {
      attendanceLog[i].isCheckin = (attendanceLog[i].isCheckin == 1) ? 0 : 1;
      attendanceLog[i].lastCheckTime = millis();
      return;
    }
  }
  
  for (int i = 0; i < 127; i++) {
    if (attendanceLog[i].fingerID == -1) {
      attendanceLog[i].fingerID = fingerID;
      attendanceLog[i].isCheckin = 0;
      attendanceLog[i].lastCheckTime = millis();
      return;
    }
  }
}

// Mỗi ngày mới → reset toàn bộ lịch sử check-in/check-out.
// Tránh trường hợp hôm trước check-in, hôm sau lại check-out.
void checkAndResetDaily() {
  unsigned long currentMillis = millis();
  int calculatedDay = (currentMillis / (24UL * 60 * 60 * 1000)) % 365;
  
  if (calculatedDay != currentDay) {
    currentDay = calculatedDay;
    resetAttendanceLog();
    
    if (hasLCD) {
      lcd.clear();
      lcd.print("New Day!");
      lcd.setCursor(0, 1);
      lcd.print("Log Reset");
      delay(2000);
      displayReady();
    }
    Serial.println("=== NEW DAY - LOG RESET ===");
  }
}

// Hiển thị trạng thái "Ready" khi hệ thống rảnh.
// Dùng sau khi kết thúc enroll, checkin hoặc báo lỗi.
void displayReady() {
  if (hasLCD) {
    lcd.clear();
    lcd.print("Place Finger");
    lcd.setCursor(0, 1);
    lcd.print("to Check In/Out");
  }
}