import apiClient from './api';

class ApiService {
    // ============================================
    // USERS
    // ============================================
    
    async getUsers() {
        return apiClient.get('/api/users');
    }
    
    async getUser(id) {
        return apiClient.get(`/api/users/${id}`);
    }
    
    async createUser(data) {
        return apiClient.post('/api/users', data);
    }
    
    async updateUser(id, data) {
        return apiClient.put(`/api/users/${id}`, data);
    }
    
    async deleteUser(id) {
        return apiClient.delete(`/api/users/${id}`);
    }
}

const apiService = new ApiService();
export default apiService;
