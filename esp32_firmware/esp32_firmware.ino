#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>

// ========== CẤU HÌNH ==========
// WiFi
const char* ssid = "?";
const char* password = "?";

// Backend Server (HTTP cho checkin)
const char* SERVER_URL = "?";
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
String TOPIC_POWER_STATUS = String("iot/device/") + DEVICE_NAME + "/power/status";

// Hardware Pins
#define RELAY_PIN 4           // GPIO4 điều khiển relay
#define AS608_RX 7           // GPIO42 -> AS608 TX (Vàng)
#define AS608_TX 15           // GPIO41 -> AS608 RX (Trắng)
#define LCD_SDA 1             // GPIO1 -> LCD SDA (Changed from 5)
#define LCD_SCL 2             // GPIO2 -> LCD SCL (Changed from 6)

// Hardware
HardwareSerial mySerial(1);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// MQTT Client
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Biến trạng thái
bool hasLCD = false;
bool powerStatus = false;      // Trạng thái nguồn (false = OFF, true = ON)
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
  Serial.println("\n\n=== ESP32 AS608 Attendance System (With Power Control) ===");

  // Cấu hình relay pin
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // Relay OFF ban đầu (LOW = mở relay = không cấp nguồn)
  powerStatus = false;
  
  Serial.println("✓ Relay initialized (Power OFF)");

  // Kết nối WiFi
  connectWiFi();

  // Kết nối MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();

  // Thông báo sẵn sàng
  Serial.println("System ready. Waiting for power ON command...");
  Serial.println("Send MQTT command: {\"action\": \"power_on\"}");
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
  
  // Heartbeat qua MQTT
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Chỉ hoạt động khi nguồn BẬT
  if (powerStatus) {
    checkAndResetDaily();
    
    // Quét vân tay để chấm công
    int fingerId = getFingerprintID();
    
    if (fingerId >= 0) {
      handleCheckin(fingerId);
    }
  }
  
  delay(50);
}

// ========== POWER CONTROL FUNCTIONS ==========

bool scanI2CDevice(uint8_t address) {
  Wire.beginTransmission(address);
  byte error = Wire.endTransmission();
  return (error == 0);
}

void powerOn() {
  if (powerStatus) {
    Serial.println("[POWER] Already ON");
    return;
  }
  
  Serial.println("[POWER] Turning ON...");
  
  // Bật relay (HIGH = đóng relay = cấp nguồn qua GND)
  digitalWrite(RELAY_PIN, HIGH);
  powerStatus = true;
  
  Serial.println("[POWER] Relay activated, waiting for power stabilization...");
  delay(2000);  // Chờ nguồn ổn định lâu hơn
  
  // Khởi động AS608 trước (không cần I2C)
  Serial.println("[POWER] Initializing AS608...");
  mySerial.begin(57600, SERIAL_8N1, AS608_RX, AS608_TX);
  delay(500);
  
  if (finger.verifyPassword()) {
    Serial.println("✓ AS608 Connected!");
  } else {
    Serial.println("✗ AS608 Not Found!");
  }
  
  // Khởi động LCD sau cùng (cần I2C)
  Serial.println("[POWER] Initializing I2C Bus...");
  Wire.begin(LCD_SDA, LCD_SCL);
  delay(300);
  
  // Scan I2C để tìm LCD
  Serial.println("[POWER] Scanning I2C devices...");
  bool lcdFound = scanI2CDevice(0x27);
  
  if (!lcdFound) {
    Serial.println("⚠ LCD not found at 0x27, trying 0x3F...");
    lcdFound = scanI2CDevice(0x3F);
  }
  
  if (lcdFound) {
    Serial.println("✓ LCD detected on I2C bus");
    
    // Khởi tạo LCD với retry
    int lcdRetry = 0;
    while (lcdRetry < 3) {
      lcd.init();
      delay(100);
      lcd.backlight();
      delay(100);
      
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Starting...");
      
      hasLCD = true;
      Serial.println("✓ LCD initialized!");
      break;
      
      lcdRetry++;
      if (lcdRetry < 3) {
        Serial.println("Retrying LCD init...");
        delay(500);
      }
    }
    
    if (lcdRetry >= 3) {
      Serial.println("⚠ LCD init failed after retries");
      hasLCD = false;
    }
  } else {
    Serial.println("⚠ LCD not detected, continuing without LCD");
    hasLCD = false;
  }
  
  delay(1000);
  
  // Hiển thị thông tin
  finger.getTemplateCount();
  Serial.print("Fingerprints: ");
  Serial.println(finger.templateCount);
  
  if (hasLCD) {
    delay(1000);
    lcd.clear();
    lcd.print("AS608: OK");
    lcd.setCursor(0, 1);
    lcd.print("Fingers: ");
    lcd.print(finger.templateCount);
    delay(2000);
  }

  resetAttendanceLog();
  displayReady();
  
  Serial.println("✓ Power ON complete");
  
  // Gửi trạng thái lên server
  sendPowerStatus();
}

void powerOff() {
  if (!powerStatus) {
    Serial.println("[POWER] Already OFF");
    return;
  }
  
  Serial.println("[POWER] Turning OFF...");
  
  if (hasLCD) {
    lcd.clear();
    lcd.print("Shutting down...");
    delay(1000);
    lcd.noBacklight();
    hasLCD = false;
  }
  
  // Tắt relay (LOW = mở relay = ngắt nguồn)
  digitalWrite(RELAY_PIN, LOW);
  powerStatus = false;
  
  Serial.println("✓ Power OFF complete");
  
  // Gửi trạng thái lên server
  sendPowerStatus();
}

void sendPowerStatus() {
  if (!mqttClient.connected()) {
    Serial.println("MQTT not connected, sending via HTTP...");
    sendPowerStatusHTTP();
    return;
  }
  
  StaticJsonDocument<256> doc;
  doc["device_name"] = DEVICE_NAME;
  doc["power_status"] = powerStatus;
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  bool published = mqttClient.publish(TOPIC_POWER_STATUS.c_str(), payload.c_str());
  
  if (published) {
    Serial.println("[MQTT] ✓ Power status sent");
  } else {
    Serial.println("[MQTT] ✗ Failed to send power status");
    sendPowerStatusHTTP();  // Fallback to HTTP
  }
}

void sendPowerStatusHTTP() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/power-status-report";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["device_name"] = DEVICE_NAME;
  doc["power_status"] = powerStatus;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  Serial.println("[HTTP] Sending power status: " + requestBody);
  
  int httpCode = http.POST(requestBody);
  
  if (httpCode > 0) {
    Serial.println("[HTTP] ✓ Power status sent");
  } else {
    Serial.println("[HTTP] ✗ Failed to send power status");
  }
  
  http.end();
}

// ========== WIFI FUNCTIONS ==========

void connectWiFi() {
  Serial.print("Connecting WiFi");
  
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
  } else {
    Serial.println("\n✗ WiFi Failed!");
  }
}

// ========== MQTT FUNCTIONS ==========

void connectMQTT() {
  Serial.print("Connecting MQTT...");
  
  String clientId = String("ESP32-") + String(random(0xffff), HEX);
  
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println(" ✓ Connected!");
    
    mqttClient.subscribe(TOPIC_COMMAND.c_str());
    
    Serial.println("✓ Subscribed to:");
    Serial.println("  - " + TOPIC_COMMAND);
  } else {
    Serial.print(" ✗ Failed, rc=");
    Serial.println(mqttClient.state());
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("[MQTT] Message on ");
  Serial.print(topic);
  Serial.print(": ");
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  if (String(topic) == TOPIC_COMMAND) {
    const char* action = doc["action"];
    
    // ========== POWER CONTROL ==========
    if (strcmp(action, "power_on") == 0) {
      Serial.println("[MQTT CMD] Power ON");
      powerOn();
    }
    else if (strcmp(action, "power_off") == 0) {
      Serial.println("[MQTT CMD] Power OFF");
      powerOff();
    }
    else if (strcmp(action, "get_power_status") == 0) {
      Serial.println("[MQTT CMD] Get power status");
      sendPowerStatus();
    }
    
    // ========== AUTO ENROLL ==========
    else if (strcmp(action, "enroll") == 0) {
      if (!powerStatus) {
        Serial.println("[ERROR] Cannot enroll - Power is OFF");
        return;
      }
      
      int employeeId = doc["employee_id"];
      const char* employeeName = doc["employee_name"];
      
      Serial.print("\n[MQTT CMD] Auto-enroll for Employee ID: ");
      Serial.print(employeeId);
      Serial.print(", Name: ");
      Serial.println(employeeName);
      
      performAutoEnrollment(employeeId, employeeName);
    }
    
    // ========== DELETE ==========
    else if (strcmp(action, "delete") == 0) {
      if (!powerStatus) {
        Serial.println("[ERROR] Cannot delete - Power is OFF");
        return;
      }
      
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

void sendHeartbeat() {
  if (!mqttClient.connected()) return;
  
  if (powerStatus) {
    finger.getTemplateCount();
  }
  
  StaticJsonDocument<256> doc;
  doc["device"] = DEVICE_NAME;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["power_status"] = powerStatus;
  doc["fingerCount"] = powerStatus ? finger.templateCount : 0;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  mqttClient.publish(TOPIC_HEARTBEAT.c_str(), payload.c_str());
  Serial.println("[MQTT] Heartbeat sent");
}

// ========== FINGERPRINT FUNCTIONS ==========

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

// ========== AUTO ENROLLMENT FUNCTIONS (GIỮ NGUYÊN) ==========

int findEmptySlot() {
  Serial.println("FINDING EMPTY SLOT");
  
  finger.getTemplateCount();
  Serial.print("Current fingerprints: ");
  Serial.println(finger.templateCount);
  Serial.print("Max capacity: 127\n");
  
  if (finger.templateCount >= 127) {
    Serial.println("DATABASE FULL! Cannot add more fingerprints.");
    return -1;
  }
  
  Serial.println("\nScanning slots 1-127...");
  
  for (int i = 1; i <= 127; i++) {
    if (i % 10 == 0) {
      Serial.print("   Checking slot ");
      Serial.print(i);
      Serial.println("...");
    }
    
    uint8_t p = finger.loadModel(i);
    
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
  }
  
  Serial.println("\nNO EMPTY SLOT FOUND!");
  Serial.println("   All 127 slots are occupied.");
  return -1;
}

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

bool enrollFingerprint(int id, const char* name) {
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
    Serial.println("✗ MQTT not connected, cannot send result");
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
    Serial.println("[MQTT] ✓ Result sent successfully");
  } else {
    Serial.println("[MQTT] ✗ Failed to send result");
  }
}

// ========== ATTENDANCE LOG MANAGEMENT ==========

void resetAttendanceLog() {
  for (int i = 0; i < 127; i++) {
    attendanceLog[i].fingerID = -1;
    attendanceLog[i].isCheckin = 1;
    attendanceLog[i].lastCheckTime = 0;
  }
  Serial.println("Attendance log reset");
}

int getIsCheckin(int fingerID) {
  for (int i = 0; i < 127; i++) {
    if (attendanceLog[i].fingerID == fingerID) {
      return attendanceLog[i].isCheckin;
    }
  }
  return 1;
}

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

void displayReady() {
  if (hasLCD) {
    lcd.clear();
    lcd.print("Place Finger");
    lcd.setCursor(0, 1);
    lcd.print("to Check In/Out");
  }
}