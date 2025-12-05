/*
 * ESP32-S3 Fingerprint + Camera device firmware (with automatic health-check)
 * Flow:
 * - Temp-enroll on device -> POST /devices/enroll-temp (send finger_id/slot)
 * - You fill employee info on website -> server builds mapping slot->employee_code
 * - Device quickly polls mappings for 60s after temp-enroll to catch the new mapping
 * - Later scans will punch IN when mapping exists
 *
 * NOTE: Fill WIFI_SSID, WIFI_PASS, API_BASE, DEVICE_TOKEN, DEVICE_KEY before flashing
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <LiquidCrystal.h>
#include <Preferences.h>
#include "esp_camera.h"
#include "esp_err.h"
#include "mbedtls/md.h"
#ifdef USE_ARDUINOJSON
#include <ArduinoJson.h>
#endif

#define JSON_DOC_SIZE (16 * 1024)

// =========================
// CONFIG — FILL THESE
// =========================
const char* WIFI_SSID = "WI - FI";
const char* WIFI_PASS = "18102004";
String API_BASE = "http://192.168.1.5:8000/api";
String DEVICE_TOKEN = "d2f4e1a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3"; // example
String DEVICE_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"; // hex or raw
const char* FIRMWARE_VER = "2025-10-05-2";

// Behavior flags (persisted to Preferences "device_cfg")
bool autoReportTempEnroll = true;
bool autoOverwriteUnmappedSlots = false;

// Preferences (global, single definition)
Preferences prefs;

// =========================
// PINOUT (adjust if needed)
// =========================
#define LCD_RS 4
#define LCD_E 5
#define LCD_D4 6
#define LCD_D5 7
#define LCD_D6 8
#define LCD_D7 9
#define BUZZER_PIN 14
#define AS608_RX 16
#define AS608_TX 17
#define STATUS_LED_PIN 2
#define ENROLL_BUTTON_PIN 0
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif
#undef STATUS_LED_PIN
#define STATUS_LED_PIN LED_BUILTIN

LiquidCrystal lcd(LCD_RS, LCD_E, LCD_D4, LCD_D5, LCD_D6, LCD_D7);
HardwareSerial SerialAS608(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&SerialAS608);

// Camera pins (example mapping; keep consistent with your hardware)
#define CAM_PWDN  -1
#define CAM_RESET -1
#define CAM_XCLK  15
#define CAM_SIOD  1
#define CAM_SIOC  3
#define CAM_Y9    40
#define CAM_Y8    39
#define CAM_Y7    38
#define CAM_Y6    37
#define CAM_Y5    36
#define CAM_Y4    35
#define CAM_Y3    34
#define CAM_Y2    33
#define CAM_VSYNC 12
#define CAM_HREF  11
#define CAM_PCLK  13

// =========================
// Constants & Buffers
// =========================
#define MAX_FINGER_SLOTS 200           // adjust to your sensor capacity
uint8_t DEVICE_KEY_BYTES[64];
size_t  DEVICE_KEY_BYTES_LEN = 0;
bool stickyFailure = false;

// Setup state / debounce / quick-sync vars
int lastPunchedSlot = -1;
unsigned long lastPunchedAt = 0;
const unsigned long PUNCH_DEBOUNCE_MS = 5000;
bool verboseGetImage = false;

// Quick mapping sync after temp-enroll
int lastEnrolledSlotPending = -1;
unsigned long lastEnrollSyncUntil = 0;
unsigned long lastMapShortPoll = 0;

// =========================
// Prototypes
// =========================
void loadDeviceSettings();
void saveDeviceSettings();
void setupCamera();
void show(const String& l1, const String& l2 = "");
void beepOK(); void beepErr(); void blinkLED(int times, int msDelay);
bool hexToBytes(const String &hex, uint8_t *out, size_t &outLen);
String hmacSha256Hex(const uint8_t* data, size_t len);
String buildSignatureForJson(const String& json);

bool sendPunch(const String& emp, const String& type, const String& method);
bool healthCheck();

void fetchMappingsAndSave();
int  requestNextFreeSlotFromServer();
int  freeOneUnmappedSlot();
int  findLocalFreeSlot();
int  getSlotOrFree();

int  identifyFingerprint();
void performTempEnroll();
void performTempEnroll2();
bool reportEnrollToServer(const String &employeeCode, int slot);
String getMappingForSlot(int slot);
void listMappings();
void sendPunchForSlot(int slot);
bool enrollFingerprintForEmployee(const String &employeeCode);
void addPendingEnrollSlot(int slot);
void resendPendingEnrolls();
void printDiagnostics();

// =========================
// Settings helpers
// =========================
void loadDeviceSettings() {
  prefs.begin("device_cfg", true);
  autoReportTempEnroll = prefs.getBool("auto_report", true);
  autoOverwriteUnmappedSlots = prefs.getBool("auto_overwrite", false);
  prefs.end();
}
void saveDeviceSettings() {
  prefs.begin("device_cfg", false);
  prefs.putBool("auto_report", autoReportTempEnroll);
  prefs.putBool("auto_overwrite", autoOverwriteUnmappedSlots);
  prefs.end();
}

// =========================
// UI helpers
// =========================
void show(const String& l1, const String& l2) {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l1);
  lcd.setCursor(0, 1); lcd.print(l2);
}
void beepOK()  { tone(BUZZER_PIN, 2000, 120); }
void beepErr() { tone(BUZZER_PIN,  400, 200); }
void blinkLED(int times, int msDelay) {
  for (int i = 0; i < times; ++i) {
    digitalWrite(STATUS_LED_PIN, HIGH); delay(msDelay);
    digitalWrite(STATUS_LED_PIN, LOW ); delay(msDelay);
  }
}

// =========================
// Crypto helpers
// =========================
bool hexToBytes(const String &hex, uint8_t *out, size_t &outLen) {
  size_t len = hex.length(); if (len % 2 != 0) return false;
  outLen = len / 2;
  auto hv = [](char c)->int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
  };
  for (size_t i = 0; i < outLen; ++i) {
    int vh = hv(hex.charAt(i*2)); int vl = hv(hex.charAt(i*2+1));
    if (vh < 0 || vl < 0) return false;
    out[i] = (uint8_t)((vh<<4) | vl);
  }
  return true;
}
String hmacSha256Hex(const uint8_t* data, size_t len) {
  uint8_t hash[32];
  mbedtls_md_context_t ctx; mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, DEVICE_KEY_BYTES, DEVICE_KEY_BYTES_LEN);
  mbedtls_md_hmac_update(&ctx, data, len);
  mbedtls_md_hmac_finish(&ctx, hash);
  mbedtls_md_free(&ctx);
  char hex[65]; for (int i=0;i<32;++i) sprintf(hex + i*2, "%02x", hash[i]); hex[64]=0;
  return String(hex);
}
String buildSignatureForJson(const String& json) {
  return "sha256=" + hmacSha256Hex((const uint8_t*)json.c_str(), json.length());
}

// =========================
// Net calls
// =========================
bool sendPunch(const String& emp, const String& type, const String& method) {
  if (WiFi.status() != WL_CONNECTED) { show("Mat mang"," "); beepErr(); return false; }
  String body = "{\"employee_code\":\"" + emp + "\",\"type\":\"" + type + "\",\"method\":\"" + method + "\"}";
  String sig = buildSignatureForJson(body);
  Serial.print("sendPunch body: "); Serial.println(body);
  Serial.print("sendPunch signature: "); Serial.println(sig);

  HTTPClient http;
  http.begin(API_BASE + "/devices/punch");
  http.addHeader("Content-Type","application/json");
  http.addHeader("Accept","application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Device-Signature", sig);
  http.setTimeout(5000);

  show("Gui du lieu..."," ");
  int code = http.POST((uint8_t*)body.c_str(), body.length());
  String resp = http.getString();
  Serial.printf("Punch HTTP code: %d\n", code);
  Serial.println(resp);
  http.end();
  if (code == 200) { show("Cham cong OK", emp); beepOK(); return true; }
  show("Cham cong FAIL"," "); beepErr(); return false;
}

bool healthCheck() {
  if (WiFi.status() != WL_CONNECTED) return false;
  unsigned long ts = millis();
  String body = "{\"ts\":" + String(ts) + "}";
  HTTPClient http;
  http.begin(API_BASE + "/devices/heartbeat");
  http.addHeader("Content-Type","application/json");
  http.addHeader("Accept","application/json");
  http.addHeader("X-DEVICE-KEY", DEVICE_KEY);
  http.setTimeout(5000);

  Serial.println("Health-check: sending...");
  Serial.print("URL: "); Serial.println(API_BASE + "/devices/heartbeat");
  Serial.print("Body: "); Serial.println(body);
  Serial.print("Key : "); Serial.println(DEVICE_KEY);

  show("Health-check..."," ");
  int code = http.POST((uint8_t*)body.c_str(), body.length());
  String resp = http.getString();
  Serial.printf("Ping HTTP code: %d\n", code);
  Serial.println(resp);
  http.end();

  if (code == 200) {
    show("Ping OK", String(ts)); beepOK();
    stickyFailure = false;
    digitalWrite(STATUS_LED_PIN, LOW);
    blinkLED(5, 100);
    digitalWrite(STATUS_LED_PIN, LOW);
    return true;
  } else {
    show("Ping FAIL"," "); beepErr();
    stickyFailure = true;
    digitalWrite(STATUS_LED_PIN, HIGH);
    return false;
  }
}

void fetchMappingsAndSave() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = API_BASE + "/devices/mappings";
  Serial.print("Fetching mappings from "); Serial.println(url);
  String sig = buildSignatureForJson("");
  http.begin(url);
  http.addHeader("Accept", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Device-Signature", sig);
  http.setTimeout(5000);
  int code = http.GET();
  String resp = http.getString();
  Serial.printf("mappings HTTP code=%d resp=%s\n", code, resp.c_str());
  if (code == 200) {
#ifdef USE_ARDUINOJSON
    DynamicJsonDocument doc(JSON_DOC_SIZE);
    DeserializationError err = deserializeJson(doc, resp);
    if (!err) {
      JsonArray arr;
      if (doc.is<JsonArray>()) arr = doc.as<JsonArray>();
      else if (doc.containsKey("data") && doc["data"].is<JsonArray>()) arr = doc["data"].as<JsonArray>();
      if (!arr.isNull()) {
        prefs.begin("finger_map", false);
        prefs.clear();
        int saved = 0;
        for (JsonObject item : arr) {
          int slot = item["slot"] | 0;
          const char* emp = item["employee_code"] | nullptr;
          if (slot > 0 && emp && strlen(emp) > 0) {
            prefs.putString((String("s") + slot).c_str(), String(emp));
            Serial.printf("Saved mapping: slot %d -> %s\n", slot, emp);
            saved++;
          }
        }
        prefs.end();
        Serial.printf("fetchMappingsAndSave: saved %d mappings\n", saved);
      }
    } else {
      Serial.print("JSON parse error: "); Serial.println(err.c_str());
    }
#else
    // Lightweight fallback parser
    int saved = 0;
    prefs.begin("finger_map", false);
    prefs.clear();
    String s = resp; int pos = 0;
    while (true) {
      int posSlot = s.indexOf("\"slot\"", pos); if (posSlot == -1) break;
      int colon = s.indexOf(':', posSlot); if (colon == -1) break;
      int i = colon + 1; while (i < s.length() && (s.charAt(i)==' '||s.charAt(i)=='\"')) i++;
      int j = i; while (j < s.length() && isDigit(s.charAt(j))) j++;
      int slot = s.substring(i, j).toInt();
      int posEmp = s.indexOf("\"employee_code\"", j); if (posEmp == -1) { pos = j; continue; }
      int colonEmp = s.indexOf(':', posEmp); if (colonEmp == -1) { pos = j; continue; }
      int start = colonEmp + 1; while (start < s.length() && (s.charAt(start)==' '||s.charAt(start)=='\"')) start++;
      int end = start; while (end < s.length() && s.charAt(end)!='"' && s.charAt(end)!=',' && s.charAt(end)!='}') end++;
      String emp = s.substring(start, end); emp.trim();
      if (slot > 0 && emp.length() > 0) {
        prefs.putString((String("s") + slot).c_str(), emp);
        Serial.printf("Saved mapping: slot %d -> %s\n", slot, emp.c_str());
        saved++;
      }
      pos = j;
    }
    prefs.end();
    Serial.printf("fetchMappingsAndSave (fallback): saved %d mappings\n", saved);
#endif
  }
  http.end();
}

int requestNextFreeSlotFromServer() {
  if (WiFi.status() != WL_CONNECTED) return -1;
  HTTPClient http;
  http.begin(API_BASE + "/devices/next-finger-slot");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("Accept","application/json");
  String sig = buildSignatureForJson("");
  Serial.print("next-finger-slot signature: "); Serial.println(sig);
  http.addHeader("X-Device-Signature", sig);
  int code = http.GET();
  String resp = http.getString();
  Serial.printf("nextSlot HTTP code: %d resp: %s\n", code, resp.c_str());
  if (code == 200) {
    int idx = resp.indexOf("\"slot\"");
    if (idx >= 0) {
      int colon = resp.indexOf(':', idx);
      int comma = resp.indexOf('}', colon);
      String num = resp.substring(colon+1, (comma==-1?resp.length():comma));
      num.trim();
      int slot = num.toInt();
      http.end();
      return slot;
    }
  }
  http.end();
  return -1;
}

// =========================
// Slot management
// =========================
int freeOneUnmappedSlot() {
  Serial.println("freeOneUnmappedSlot: scanning for unmapped occupied slot...");
  prefs.begin("finger_map", true);
  for (int i = 1; i <= MAX_FINGER_SLOTS; ++i) {
    int r = finger.loadModel(i);
    if (r == FINGERPRINT_OK) {
      String mapped = prefs.getString((String("s") + i).c_str(), "");
      if (mapped.length() == 0) {
        prefs.end();
        Serial.printf("Deleting unmapped slot %d\n", i);
        int del = finger.deleteModel(i);
        if (del == FINGERPRINT_OK) { Serial.printf("Deleted slot %d OK\n", i); return i; }
        else { Serial.printf("deleteModel(%d) -> %d\n", i, del); }
        prefs.begin("finger_map", true); // re-open for loop continuity
      }
    }
    delay(5);
  }
  prefs.end();
  Serial.println("freeOneUnmappedSlot: none found");
  return -1;
}

// NEW tolerant free-slot finder (fixes "No slot" on quirky sensors)
int findLocalFreeSlot() {
  int cnt = finger.getTemplateCount();
  Serial.printf("findLocalFreeSlot: sensor getTemplateCount -> %d\n", cnt);
  for (int i = 1; i <= MAX_FINGER_SLOTS; ++i) {
    int r = finger.loadModel(i);
    if (r == FINGERPRINT_OK) {
      // occupied
    } else {
      // Many modules return various codes for empty cells; any non-OK => consider FREE
      Serial.printf("findLocalFreeSlot: slot %d considered FREE (loadModel=%d)\n", i, r);
      return i;
    }
    delay(4);
  }
  Serial.println("findLocalFreeSlot: no free slot in 1..MAX_FINGER_SLOTS");
  return -1;
}

int getSlotOrFree() {
  // 1) Prefer LOCAL (fast, offline)
  int slot = findLocalFreeSlot();
  if (slot >= 0) return slot;

  // 2) Try server coordination
  slot = requestNextFreeSlotFromServer();
  if (slot >= 0) return slot;

  // 3) Optionally free an unmapped occupied slot
  if (autoOverwriteUnmappedSlots) {
    int freed = freeOneUnmappedSlot();
    if (freed > 0) return freed;
  }
  return -1;
}

// =========================
// Fingerprint ops
// =========================
int identifyFingerprint() {
  int imgStatus = finger.getImage();
  if (imgStatus != FINGERPRINT_OK) {
    if (verboseGetImage) Serial.printf("getImage status: %d\n", imgStatus);
    return -1;
  }
  show("Dang quet"," ");
  Serial.println("Finger detected, converting image...");

  int conv = finger.image2Tz(1);
  Serial.printf("image2Tz result: %d\n", conv);
  if (conv != FINGERPRINT_OK) {
    show("Quet that bai","TZ err"); beepErr(); delay(700);
    return -1;
  }

  Serial.println("Searching templates...");
  int p = finger.fingerFastSearch();
  Serial.printf("fingerFastSearch result: %d\n", p);
  if (p == FINGERPRINT_OK) {
    int id = finger.fingerID;
    int score = finger.confidence;
    Serial.printf("Fingerprint found: id=%d score=%d\n", id, score);
    show("Quet xong", "ID:" + String(id)); beepOK(); delay(700);
    return id;
  } else {
    Serial.println("Fingerprint not found");
    show("Khong tim thay"," "); beepErr(); delay(700);
    return -1;
  }
}

bool reportEnrollToServer(const String &employeeCode, int slot) {
  if (WiFi.status() != WL_CONNECTED) return false;
  String body = "{\"employee_code\":\"" + employeeCode + "\",\"finger_id\":" + String(slot) + "}";
  String sig = buildSignatureForJson(body);
  Serial.print("reportEnrollToServer body: "); Serial.println(body);
  Serial.print("reportEnroll signature: "); Serial.println(sig);
  HTTPClient http;
  http.begin(API_BASE + "/devices/enroll");
  http.addHeader("Content-Type","application/json");
  http.addHeader("Accept","application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Device-Signature", sig);
  http.setTimeout(5000);
  int code = http.POST((uint8_t*)body.c_str(), body.length());
  String resp = http.getString();
  Serial.printf("Enroll HTTP code: %d\n", code);
  Serial.println(resp);
  http.end();
  bool ok = (code == 200);
  if (ok) {
    prefs.begin("finger_map", false);
    prefs.putString((String("s") + slot).c_str(), employeeCode);
    prefs.end();
    Serial.printf("Saved mapping: slot %d -> %s\n", slot, employeeCode.c_str());
  }
  return ok;
}

String getMappingForSlot(int slot) {
  prefs.begin("finger_map", true);
  String v = prefs.getString((String("s") + slot).c_str(), "");
  prefs.end();
  return v;
}

void listMappings() {
  Serial.println("Saved fingerprint mappings:");
  prefs.begin("finger_map", true);
  for (int i = 1; i <= MAX_FINGER_SLOTS; ++i) {
    String v = prefs.getString((String("s") + i).c_str(), "");
    if (v.length() > 0) Serial.printf("  slot %d -> %s\n", i, v.c_str());
  }
  prefs.end();
}

void sendPunchForSlot(int slot) {
  String emp = getMappingForSlot(slot);
  if (emp.length() == 0) {
    Serial.printf("No mapping for slot %d\n", slot);
    return;
  }
  Serial.printf("Triggering punch: slot %d -> %s\n", slot, emp.c_str());
  if (!sendPunch(emp, "IN", "FINGERPRINT")) {
    Serial.println("sendPunch failed");
  }
}

bool enrollFingerprintForEmployee(const String &employeeCode) {
  show("Enrolling...", employeeCode);
  int slot = getSlotOrFree();
  if (slot < 0) {
    Serial.println("No free slot available");
    show("Enroll FAIL","No slot"); beepErr();
    return false;
  }
  Serial.printf("Using slot %d\n", slot);

  show("Place finger 1"," ");
  while (finger.getImage() != FINGERPRINT_OK) { delay(200); }
  if (finger.image2Tz(1) != FINGERPRINT_OK) { show("Err","TZ1"); beepErr(); return false; }

  show("Place finger 2"," ");
  while (finger.getImage() != FINGERPRINT_OK) { delay(200); }
  if (finger.image2Tz(2) != FINGERPRINT_OK) { show("Err","TZ2"); beepErr(); return false; }

  if (finger.createModel() != FINGERPRINT_OK) { show("Create model","Fail"); beepErr(); return false; }
  if (finger.storeModel(slot) != FINGERPRINT_OK) { show("Store model","Fail"); beepErr(); return false; }

  bool ok = reportEnrollToServer(employeeCode, slot);
  if (ok) { show("Enroll OK", employeeCode); beepOK(); return true; }
  else    { show("Enroll FAIL","srv"); beepErr(); return false; }
}

// Enhanced temp-enroll with quick mapping sync window
void performTempEnroll2() {
  const unsigned long PRESENT_TIMEOUT_MS = 60000;
  const unsigned long ABSENT_TIMEOUT_MS  = 20000;
  const int POST_RETRIES = 3;
  const unsigned long RETRY_BUTTON_WINDOW_MS = 10000;

  Serial.println("performTempEnroll2: start");
  show("Them van tay moi","Waiting for finger...");

  int slot = getSlotOrFree();
  if (slot < 0) { show("No slot"," "); beepErr(); Serial.println("No slot available"); return; }
  Serial.printf("Temp-enroll using slot %d\n", slot);

  bool retryOuter = false;
  do {
    retryOuter = false;

    // First capture
    show("Them van tay moi","Dua tay vao...");
    unsigned long t0 = millis(); bool got=false;
    while (millis() - t0 < PRESENT_TIMEOUT_MS) {
      int s = finger.getImage(); if (s == FINGERPRINT_OK) { got=true; break; }
      if (s == FINGERPRINT_NOFINGER) { delay(120); continue; }
      if (verboseGetImage) Serial.printf("getImage wait1: %d\n", s);
      delay(120);
    }
    if (!got) { show("Timeout","No finger"); beepErr(); Serial.println("Timeout wait 1"); return; }
    if (finger.image2Tz(1) != FINGERPRINT_OK) {
      show("Err","TZ1"); beepErr(); Serial.println("image2Tz(1) failed");
      show("Loi mau 1","Bam nut de thu"); unsigned long st=millis(); bool pressed=false;
      while (millis()-st < RETRY_BUTTON_WINDOW_MS) { if (digitalRead(ENROLL_BUTTON_PIN)==LOW) { pressed=true; break; } delay(50); }
      if (pressed) { retryOuter = true; continue; } else return;
    }
    show("Hoan tat luot 1","Bo tay ra"); beepOK(); delay(700);

    // Wait absent
    unsigned long t1 = millis();
    while (millis() - t1 < ABSENT_TIMEOUT_MS) { if (finger.getImage() == FINGERPRINT_NOFINGER) break; delay(120); }

    // Second capture
    show("Dat lai ngon tay","Lan 2");
    t0 = millis(); got=false;
    while (millis() - t0 < PRESENT_TIMEOUT_MS) {
      int s = finger.getImage(); if (s == FINGERPRINT_OK) { got=true; break; }
      if (s == FINGERPRINT_NOFINGER) { delay(120); continue; }
      if (verboseGetImage) Serial.printf("getImage wait2: %d\n", s);
      delay(120);
    }
    if (!got) { show("Timeout","No finger 2"); beepErr(); Serial.println("Timeout wait 2"); return; }
    if (finger.image2Tz(2) != FINGERPRINT_OK) {
      show("Err","TZ2"); beepErr(); Serial.println("image2Tz(2) failed");
      show("Loi mau 2","Bam nut de thu"); unsigned long st2=millis(); bool pressed2=false;
      while (millis()-st2 < RETRY_BUTTON_WINDOW_MS) { if (digitalRead(ENROLL_BUTTON_PIN)==LOW) { pressed2=true; break; } delay(50); }
      if (pressed2) { retryOuter = true; continue; } else return;
    }
    show("Hoan tat luot 2","Dang xu ly..."); delay(500);

    int model = finger.createModel();
    if (model != FINGERPRINT_OK) {
      show("Tao mau that bai","Bam nut thu lai"); beepErr(); Serial.printf("createModel failed: %d\n", model);
      unsigned long st3=millis(); bool pressed3=false;
      while (millis()-st3 < RETRY_BUTTON_WINDOW_MS) { if (digitalRead(ENROLL_BUTTON_PIN)==LOW) { pressed3=true; break; } delay(50); }
      if (pressed3) { retryOuter = true; continue; } else return;
    }
    int store = finger.storeModel(slot);
    if (store != FINGERPRINT_OK) { show("Luu that bai"," "); beepErr(); Serial.printf("storeModel failed: %d\n", store); return; }
    show("Luu thanh cong","Slot:" + String(slot)); beepOK(); delay(500);

    // Report temp enroll (slot) to server
    bool reported=false;
    if (WiFi.status() == WL_CONNECTED) {
      String body = "{\"finger_id\": " + String(slot) + "}";
      String sig = buildSignatureForJson(body);
      Serial.print("enroll-temp body: "); Serial.println(body); Serial.print("sig: "); Serial.println(sig);
      for (int a=1; a<=POST_RETRIES; ++a) {
        HTTPClient http; http.begin(API_BASE + "/devices/enroll-temp");
        http.addHeader("Content-Type","application/json");
        http.addHeader("Accept","application/json");
        http.addHeader("X-Device-Token", DEVICE_TOKEN);
        http.addHeader("X-Device-Signature", sig);
        http.setTimeout(5000);
        int code = http.POST((uint8_t*)body.c_str(), body.length());
        String resp = http.getString(); http.end();
        Serial.printf("enroll-temp attempt %d code=%d resp=%s\n", a, code, resp.c_str());
        if (code == 200) { reported=true; break; }
        delay(700);
      }
    }

    if (reported) {
      show("Da gui, cho duyet","tren Web (60s)"); beepOK();
      // Start quick sync window
      lastEnrolledSlotPending = slot;
      lastEnrollSyncUntil = millis() + 60000UL;
      lastMapShortPoll = 0;
    } else {
      show("Luu tam & cho mang","Web duyet sau"); beepErr();
      addPendingEnrollSlot(slot);
      // Still allow quick sync window (in case mapping appears soon)
      lastEnrolledSlotPending = slot;
      lastEnrollSyncUntil = millis() + 60000UL;
      lastMapShortPoll = 0;
    }

  } while (retryOuter);
}

// =========================
// Pending queue helpers
// =========================
void addPendingEnrollSlot(int slot) {
  prefs.begin("pending_enrolls", false);
  String cur = prefs.getString("slots", "");
  bool exists = false;
  if (cur.length() > 0) {
    int idx = 0;
    while (idx < cur.length()) {
      int comma = cur.indexOf(',', idx);
      String token = (comma==-1) ? cur.substring(idx) : cur.substring(idx, comma);
      token.trim();
      if (token == String(slot)) { exists = true; break; }
      idx = (comma==-1) ? cur.length() : comma + 1;
    }
  }
  if (!exists) {
    if (cur.length() > 0) cur += ",";
    cur += String(slot);
    prefs.putString("slots", cur);
    Serial.printf("Queued pending enroll slot: %d (now: %s)\n", slot, cur.c_str());
  } else {
    Serial.printf("Slot %d already in pending queue\n", slot);
  }
  prefs.end();
}

void resendPendingEnrolls() {
  if (WiFi.status() != WL_CONNECTED) return;
  prefs.begin("pending_enrolls", false);
  String cur = prefs.getString("slots", "");
  if (cur.length() == 0) { prefs.end(); return; }
  Serial.printf("Resend pending enrolls: %s\n", cur.c_str());
  int idx = 0;
  while (idx < cur.length()) {
    int comma = cur.indexOf(',', idx);
    String token = (comma==-1) ? cur.substring(idx) : cur.substring(idx, comma);
    idx = (comma==-1) ? cur.length() : comma + 1;
    token.trim();
    if (token.length() == 0) continue;
    int slot = token.toInt();

    String body = "{\"finger_id\": " + String(slot) + "}";
    String sig = buildSignatureForJson(body);
    HTTPClient http; http.begin(API_BASE + "/devices/enroll-temp");
    http.addHeader("Content-Type","application/json");
    http.addHeader("Accept","application/json");
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
    http.addHeader("X-Device-Signature", sig);
    http.setTimeout(5000);
    int code = http.POST((uint8_t*)body.c_str(), body.length());
    String resp = http.getString(); http.end();
    Serial.printf("Resend slot %d -> code=%d resp=%s\n", slot, code, resp.c_str());

    if (code == 200) {
      // remove first occurrence
      String toRemove = String(slot);
      int pos = cur.indexOf(toRemove);
      if (pos >= 0) {
        int len = toRemove.length();
        cur = cur.substring(0, pos) + ((pos+len < cur.length() && cur.charAt(pos+len)==',') ? cur.substring(pos+len+1) : cur.substring(pos+len));
      }
      prefs.putString("slots", cur);
      Serial.printf("Resend success, queue now: %s\n", cur.c_str());
    } else {
      Serial.println("Resend failed, stop and retry later");
      break;
    }
  }
  prefs.end();
}

// =========================
void printDiagnostics() {
  Serial.println("=== DEVICE DIAGNOSTICS ===");
  Serial.print("Firmware: "); Serial.println(FIRMWARE_VER);
  Serial.print("API_BASE: "); Serial.println(API_BASE);
  Serial.print("WiFi status: "); Serial.println(WiFi.status());
  if (WiFi.status() == WL_CONNECTED) { Serial.print("IP: "); Serial.println(WiFi.localIP()); }
  Serial.print("Sticky failure: "); Serial.println(stickyFailure?"true":"false");

  int cnt = finger.getTemplateCount();
  Serial.printf("Template count: %d\n", cnt);

  Serial.println("-- Probe occupied slots (1..MAX) --");
  int found = 0;
  for (int i = 1; i <= MAX_FINGER_SLOTS; ++i) {
    int r = finger.loadModel(i);
    if (r == FINGERPRINT_OK) { Serial.printf("  slot %d: OCCUPIED\n", i); found++; }
    else if (r == FINGERPRINT_NOTFOUND) { /* free */ }
    else { Serial.printf("  slot %d: code %d (likely FREE)\n", i, r); }
    delay(10);
  }
  Serial.printf("Occupied (probe): %d\n", found);

  prefs.begin("finger_map", true);
  int mapped = 0;
  for (int i = 1; i <= MAX_FINGER_SLOTS; ++i) {
    String v = prefs.getString((String("s") + i).c_str(), "");
    if (v.length() > 0) { Serial.printf("  map %d -> %s\n", i, v.c_str()); mapped++; }
  }
  prefs.end();
  Serial.printf("Mappings saved: %d\n", mapped);

  prefs.begin("pending_enrolls", true);
  String pending = prefs.getString("slots", "");
  prefs.end();
  Serial.print("autoReportTempEnroll: "); Serial.println(autoReportTempEnroll?"true":"false");
  Serial.print("autoOverwriteUnmappedSlots: "); Serial.println(autoOverwriteUnmappedSlots?"true":"false");
  Serial.print("Pending enroll slots: "); Serial.println(pending.length()?pending:"(empty)");

  int srv = requestNextFreeSlotFromServer();
  Serial.printf("Server next-finger-slot: %d\n", srv);
  Serial.println("=== END DIAGNOSTICS ===");
}

// =========================
// Setup / Loop
// =========================
void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = CAM_Y2;  config.pin_d1 = CAM_Y3;  config.pin_d2 = CAM_Y4;  config.pin_d3 = CAM_Y5;
  config.pin_d4 = CAM_Y6;  config.pin_d5 = CAM_Y7;  config.pin_d6 = CAM_Y8;  config.pin_d7 = CAM_Y9;
  config.pin_xclk = CAM_XCLK; config.pin_pclk = CAM_PCLK;
  config.pin_vsync = CAM_VSYNC; config.pin_href = CAM_HREF;
  config.pin_sccb_sda = CAM_SIOD; config.pin_sccb_scl = CAM_SIOC;
  config.pin_pwdn = CAM_PWDN; config.pin_reset = CAM_RESET;
  config.xclk_freq_hz = 20000000; config.pixel_format = PIXFORMAT_JPEG;
  if (psramFound()) { config.frame_size = FRAMESIZE_QVGA; config.jpeg_quality = 12; config.fb_count = 2; }
  else              { config.frame_size = FRAMESIZE_QVGA; config.jpeg_quality = 16; config.fb_count = 1; }

  Serial.print("psramFound: "); Serial.println(psramFound() ? "true" : "false");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x (%s)\n", err, esp_err_to_name(err));
    show("Loi camera"," "); beepErr();
    Serial.println("Fallback camera init...");
    config.frame_size = FRAMESIZE_QQVGA; config.jpeg_quality = 18; config.fb_count = 1;
    esp_err_t err2 = esp_camera_init(&config);
    if (err2 != ESP_OK) { Serial.printf("Fallback failed: 0x%x (%s)\n", err2, esp_err_to_name(err2)); delay(1000); }
    else { Serial.println("Fallback camera init OK"); }
  }
}

void setup() {
  Serial.begin(115200);
  lcd.begin(16,2);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(ENROLL_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(STATUS_LED_PIN, LOW);
  stickyFailure = false;
  show("Khoi dong...", FIRMWARE_VER);
  delay(500);

  // Decode DEVICE_KEY (hex or raw ASCII)
  if (hexToBytes(DEVICE_KEY, DEVICE_KEY_BYTES, DEVICE_KEY_BYTES_LEN)) {
    Serial.printf("DEVICE_KEY hex (%u bytes)\n", (unsigned)DEVICE_KEY_BYTES_LEN);
  } else {
    size_t rawLen = DEVICE_KEY.length(); if (rawLen > sizeof(DEVICE_KEY_BYTES)) rawLen = sizeof(DEVICE_KEY_BYTES);
    for (size_t i=0;i<rawLen;++i) DEVICE_KEY_BYTES[i] = (uint8_t)DEVICE_KEY.charAt(i);
    DEVICE_KEY_BYTES_LEN = rawLen;
    Serial.printf("DEVICE_KEY raw ASCII (%u bytes)\n", (unsigned)DEVICE_KEY_BYTES_LEN);
  }

  // WiFi
  show("Dang ket noi..."," ");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) { delay(300); }
  if (WiFi.status() == WL_CONNECTED) {
    String ip = WiFi.localIP().toString();
    show("WiFi OK", ip);
    Serial.print("WiFi connected, IP: "); Serial.println(ip);
    delay(400); blinkLED(2, 120);
    bool ok = healthCheck();
    Serial.printf("Health-check: %s\n", ok?"OK":"FAIL");
    if (ok) {
      Serial.println("Fetching mappings after connect...");
      delay(200);
      fetchMappingsAndSave();
      Serial.println("Resend pending enrolls...");
      resendPendingEnrolls();
    }
  } else {
    show("WiFi FAIL"," "); Serial.println("WiFi connect failed!"); beepErr();
  }

  // AS608
  SerialAS608.begin(57600, SERIAL_8N1, AS608_RX, AS608_TX);
  finger.begin(57600);
  if (finger.verifyPassword()) { Serial.println("AS608 OK"); show("AS608 OK"," "); }
  else { Serial.println("AS608 FAIL"); show("AS608 FAIL"," "); beepErr(); delay(1200); }

  setupCamera();
  delay(400);
  loadDeviceSettings();
  show("Ready","Moi quet van tay");
}

// =========================
void loop() {
  // keep display alive
  static unsigned long lastIdle = 0;
  if (millis() - lastIdle > 5000) { show("Moi quet van tay"," "); lastIdle = millis(); }

  // auto-reconnect WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting...");
    WiFi.reconnect();
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) { delay(200); }
    if (WiFi.status() == WL_CONNECTED) { Serial.println("WiFi reconnected"); show("WiFi reconnected"," "); blinkLED(2, 100); delay(200); healthCheck(); }
    else { Serial.println("Reconnect failed"); show("No WiFi"," "); digitalWrite(STATUS_LED_PIN, HIGH); }
  }

  // Serial commands
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n'); line.trim();
    if (line.length()>0 && line.charAt(0)=='E') {
      String empCode = line.substring(1); Serial.printf("Enroll command for %s\n", empCode.c_str()); enrollFingerprintForEmployee(empCode);
    }
    if (line.length() > 0) {
      if (line == "M") listMappings();
      else if (line.startsWith("P")) { int slot = line.substring(1).toInt(); if (slot>0) sendPunchForSlot(slot); }
      else if (line.startsWith("D")) { int slot = line.substring(1).toInt(); if (slot>0){ Serial.printf("Delete slot %d...\n", slot); int r=finger.deleteModel(slot); if (r==FINGERPRINT_OK) Serial.println("Delete OK"); else Serial.printf("Delete returned %d\n", r);} }
      else if (line == "C") {
        Serial.println("CLEAR ALL 1..MAX_FINGER_SLOTS (confirm Y)"); unsigned long now=millis();
        while (millis()-now < 5000 && !Serial.available()) delay(50);
        if (Serial.available()) { String conf=Serial.readStringUntil('\n'); conf.trim();
          if (conf=="Y"||conf=="y"){ int deleted=0; for (int i=1;i<=MAX_FINGER_SLOTS;++i){int r=finger.deleteModel(i); if (r==FINGERPRINT_OK) deleted++; delay(15);} Serial.printf("Deleted %d templates\n", deleted);}
          else Serial.println("Clear aborted");
        } else Serial.println("Abort: no confirmation");
      }
      else if (line == "L") { prefs.begin("finger_map", false); prefs.clear(); prefs.end(); Serial.println("Cleared mappings"); }
      else if (line == "S") { Serial.println("Manual scan (S)"); int found = identifyFingerprint(); if (found>0) Serial.printf("Manual scan: slot %d\n", found); else Serial.println("No match / no finger"); }
      else if (line == "T") { Serial.println("Query template count (T)..."); int cnt=finger.getTemplateCount(); Serial.printf("Template count: %d\n", cnt); int freeSlot=findLocalFreeSlot(); if (freeSlot>0) Serial.printf("Quick free slot: %d\n", freeSlot); else Serial.println("No free slot found"); }
      else if (line == "DIAG") { Serial.println("Running diagnostics..."); printDiagnostics(); }
      else if (line == "R") { Serial.println("Manual resend (R)"); resendPendingEnrolls(); }
      else if (line == "V") { verboseGetImage=!verboseGetImage; Serial.printf("Verbose: %s\n", verboseGetImage?"ON":"OFF"); }
      else if (line == "A") { autoReportTempEnroll=!autoReportTempEnroll; saveDeviceSettings(); Serial.printf("autoReportTempEnroll: %s\n", autoReportTempEnroll?"ON":"OFF"); }
      else if (line == "O") { autoOverwriteUnmappedSlots=!autoOverwriteUnmappedSlots; saveDeviceSettings(); Serial.printf("autoOverwriteUnmappedSlots: %s\n", autoOverwriteUnmappedSlots?"ON":"OFF"); }
      else if (line == "B") { Serial.println("Manual temp-enroll (B)"); performTempEnroll2(); }
      else if (line == "F") { Serial.println("Force fetch mappings (F)"); fetchMappingsAndSave(); }
    }
  }

  // Double-press enroll button for temp-enroll
  static unsigned long lastPress = 0; static int pressCount = 0;
  if (digitalRead(ENROLL_BUTTON_PIN) == LOW) {
    Serial.printf("Enroll button press at %lu\n", millis());
    unsigned long now = millis();
    if (now - lastPress < 1000) pressCount++; else pressCount = 1;
    lastPress = now;
    while (digitalRead(ENROLL_BUTTON_PIN) == LOW) delay(10);
    if (pressCount >= 2) { Serial.println("Double-press -> temp-enroll"); performTempEnroll2(); pressCount = 0; }
  }

  // Auto-detect finger
  static unsigned long lastFingerCheck = 0;
  if (millis() - lastFingerCheck > 300) {
    lastFingerCheck = millis();
    int slot = identifyFingerprint();
    if (slot > 0) {
      String emp = getMappingForSlot(slot);
      unsigned long now = millis();
      if (emp.length() > 0) {
        if (slot != lastPunchedSlot || now - lastPunchedAt > PUNCH_DEBOUNCE_MS) {
          Serial.printf("Auto-punch: slot %d -> %s\n", slot, emp.c_str());
          show("Cham cong...", emp);
          sendPunchForSlot(slot);
          lastPunchedSlot = slot; lastPunchedAt = now;
        } else {
          Serial.println("Ignored duplicate punch due to debounce");
        }
      } else {
        Serial.printf("Slot %d scanned but no mapping yet\n", slot);
        show("Chua gan nhan vien","Slot " + String(slot));
      }
      delay(500);
    }
  }

  // Quick mapping poll for 60 seconds after temp-enroll
  if (lastEnrolledSlotPending > 0 && millis() < lastEnrollSyncUntil) {
    if (millis() - lastMapShortPoll > 3000) {
      lastMapShortPoll = millis();
      fetchMappingsAndSave();
      String emp = getMappingForSlot(lastEnrolledSlotPending);
      if (emp.length() > 0) {
        show("Map OK", "Slot "+String(lastEnrolledSlotPending)+" -> "+emp);
        beepOK();
        Serial.printf("Quick-sync: slot %d mapped to %s\n", lastEnrolledSlotPending, emp.c_str());
        lastEnrolledSlotPending = -1;
        lastEnrollSyncUntil = 0;
      } else {
        Serial.printf("Quick-sync: slot %d not mapped yet\n", lastEnrolledSlotPending);
      }
    }
  } else if (millis() >= lastEnrollSyncUntil && lastEnrollSyncUntil != 0) {
    // end of quick-sync window
    lastEnrolledSlotPending = -1;
    lastEnrollSyncUntil = 0;
    show("Cho quet tiep","Ready");
  }

  // Background resend & periodic mapping sync
  static unsigned long lastResend = 0;
  if (millis() - lastResend > 10000) { lastResend = millis(); resendPendingEnrolls(); }
    const unsigned long MAP_SYNC_INTERVAL_MS = 15000UL; // 15 seconds
    static unsigned long lastMapSync = 0;
    if (millis() - lastMapSync > MAP_SYNC_INTERVAL_MS) { lastMapSync = millis(); fetchMappingsAndSave(); }

  delay(200);
}