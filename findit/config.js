// config.js
// Centralized configuration for server connection
// Change the IP address and port here to update it across the entire app

const API_CONFIG = {
  // Server IP address and port
  IP_ADDRESS: '192.168.100.10',
  PORT: '5003',
  
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
  }
};

export default API_CONFIG; 