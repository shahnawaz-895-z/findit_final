// config.js
// Centralized configuration for server connection
// Change the IP address and port here to update it across the entire app

// API Configuration
const API_CONFIG = {
  // Server IP address and port
  IP_ADDRESS: '192.168.18.18',
  PORT: '5000',
  
  // Full URLs for different endpoints
  get BASE_URL() {
    return `http://${this.IP_ADDRESS}`;
  },
  get API_URL() {
    return `http://${this.IP_ADDRESS}:${this.PORT}`;
  },
  
  // Common endpoints
  get LOGIN_URL() {
    return `${this.API_URL}/login`;
  },
  get REGISTER_URL() {
    return `${this.API_URL}/register`;
  },
  
  // Lost and Found endpoints
  get LOST_ITEMS_URL() {
    return `${this.API_URL}/lostitem`;
  },
  get FOUND_ITEMS_URL() {
    return `${this.API_URL}/founditem`;
  },
  
  // Other configuration constants
  POLLING_INTERVAL: 10000, // 10 seconds
  
  // API Endpoints
  get loginEndpoint() {
    return `${this.API_URL}/login`;
  },
  get registerEndpoint() {
    return `${this.API_URL}/register`;
  },
  get lostItemEndpoint() {
    return `${this.API_URL}/lostitem`;
  },
  get foundItemEndpoint() {
    return `${this.API_URL}/founditem`;
  }
};

export default API_CONFIG;
export const { API_URL, POLLING_INTERVAL } = API_CONFIG;

// Other configuration constants can be added here 