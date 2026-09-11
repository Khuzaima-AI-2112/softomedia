// Centralized API Configuration
// This is the SINGLE SOURCE OF TRUTH for the backend URL
// All components MUST import from this file

// Use environment variable from window.ENV (injected at runtime) or build-time fallback
const runtimeApiUrl = window.ENV && window.ENV.VITE_API_URL;
export const API_URL = import.meta.env.DEV
    ? import.meta.env.VITE_API_URL || runtimeApiUrl || 'http://localhost:8080'
    : runtimeApiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8080';


