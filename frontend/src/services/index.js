import apiClient from './api';

// Authentication
export const authService = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  getCurrentUser: () => apiClient.get('/auth/me'),
  changePassword: (data) => apiClient.post('/auth/change-password', data),
  refreshToken: () => apiClient.post('/auth/refresh'),
};

// Employees
export const employeeService = {
  getAll: (params) => apiClient.get('/employees', { params }),
  getById: (id) => apiClient.get(`/employees/${id}`),
  search: (name, params) => apiClient.get(`/employees/search/${name}`, { params }),
  create: (data) => apiClient.post('/employees', data),
  update: (id, data) => apiClient.put(`/employees/${id}`, data),
  delete: (id) => apiClient.delete(`/employees/${id}`),
};

// Records (Attendance)
export const recordService = {
  getAll: (params) => apiClient.get('/records', { params }),
  getTodayRecords: (params) => apiClient.get('/records/today', { params }),
  getStatistics: (params) => apiClient.get('/records/statistics', { params }),
  createManual: (data) => apiClient.post('/records/manual', data),
  delete: (id) => apiClient.delete(`/records/${id}`),
};

// Devices (ESP32)
export const deviceService = {
  getStatus: () => apiClient.get('/device/status'),
};
