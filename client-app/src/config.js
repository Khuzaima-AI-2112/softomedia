// Centralized API Configuration
// This is the SINGLE SOURCE OF TRUTH for the backend URL
// All components MUST import from this file

// Use environment variable from window.ENV (injected at runtime) or build-time fallback
export const API_URL = (window.ENV && window.ENV.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:8080';


