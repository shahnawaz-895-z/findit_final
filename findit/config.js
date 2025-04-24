// config.js
// Centralized configuration for server connection
import { Platform } from 'react-native';

// Server IP Address - this is your machine's IP on the local network
// To access the server from other devices on the network, use: http://192.168.0.118:5000
const SERVER_IP = '192.168.100.10';

// API Configuration
const API_CONFIG = {
  // Server IP address and port - using environment variables with fallbacks
  IP_ADDRESS: process.env.API_HOST || Platform.select({
    ios: SERVER_IP, // Using the actual IP instead of localhost for iOS to work on real devices
    android: SERVER_IP, // Your actual IPv4 address
    web: 'localhost'
  }),
  PORT: process.env.API_PORT || '5000',
  
  // Full URLs for different endpoints
  get BASE_URL() {
    return Platform.select({
      ios: `http://${this.IP_ADDRESS}`,
      android: `http://${this.IP_ADDRESS}`,
      web: `http://${this.IP_ADDRESS}`
    });
  },

  get API_URL() {
    return `${this.BASE_URL}:${this.PORT}`;
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
  POLLING_INTERVAL: 5000, // 5 seconds - more frequent polling for notifications
  
  // API Endpoints
  get loginEndpoint() {
    return this.LOGIN_URL;
  },

  get registerEndpoint() {
    return this.REGISTER_URL;
  },

  get lostItemEndpoint() {
    return this.LOST_ITEMS_URL;
  },

  get foundItemEndpoint() {
    return this.FOUND_ITEMS_URL;
  },

  get profileEndpoint() {
    return `${this.API_URL}/profile`;
  },

  get messagesEndpoint() {
    return `${this.API_URL}/api/messages`;
  },

  get notificationsEndpoint() {
    return `${this.API_URL}/notifications`;
  }
};

export default API_CONFIG;
export const { 
  API_URL, 
  POLLING_INTERVAL,
  IP_ADDRESS,
  PORT,
} = API_CONFIG;