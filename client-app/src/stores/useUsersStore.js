import { create } from 'zustand';
import { usersAPI } from '../services/api.js';

const useUsersStore = create((set) => ({
    users: [],
    loading: false,
    error: null,

    fetchUsers: async (role = null) => {
        set({ loading: true, error: null });
        try {
            const data = await usersAPI.list(role);
            set({ users: data.users || [], loading: false });
        } catch (error) {
            console.error('Failed to fetch users:', error);
            set({ error: error.message, loading: false });
        }
    },

    createUser: async (userData) => {
        set({ loading: true, error: null });
        try {
            const newUser = await usersAPI.create(userData);
            set((state) => ({
                users: [...state.users, newUser],
                loading: false
            }));
            return newUser;
        } catch (error) {
            console.error('Failed to create user:', error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    deleteUser: async (id) => {
        set({ loading: true, error: null });
        try {
            await usersAPI.delete(id);
            set((state) => ({
                users: state.users.map(u => u.id === id ? { ...u, status: 'inactive' } : u),
                loading: false
            }));
        } catch (error) {
            console.error('Failed to delete user:', error);
            set({ error: error.message, loading: false });
        }
    }
}));

export default useUsersStore;
