// Centralized API Configuration
// This is the SINGLE SOURCE OF TRUTH for the backend URL
// All components MUST import from this file

export const API_URL = window.ENV?.VITE_API_URL || 'http://localhost:8080';
export const MAPS_API_KEY = import.meta.env.VITE_MAPS_API_KEY || '';
