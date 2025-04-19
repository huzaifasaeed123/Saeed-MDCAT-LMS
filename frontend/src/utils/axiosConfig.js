import axios from 'axios';

// Base URL for API
const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for cookies to work
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding the access token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from memory (if available)
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling 401 errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and not already retrying and not refresh token route
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data.tokenExpired &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh-token')
    ) {
      originalRequest._retry = true;
      
      try {
        // Call the refresh token endpoint to get a new access token
        const response = await apiClient.post('/auth/refresh-token');
        
        // Update the access token in memory
        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        
        // Update the Authorization header for the original request
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        
        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh token is expired or invalid, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;