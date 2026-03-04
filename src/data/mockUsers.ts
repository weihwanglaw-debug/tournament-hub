/**
 * Single source of truth for admin users in the mock/frontend stage.
 * Both AuthContext and UserManagement read/write this store.
 * Replace with API calls when backend is ready.
 */
import type { AdminUser } from "@/types/config";
import configUsers from "@/data/config.json";

// Initialise from config.json so the JSON remains the seed data
let _users: AdminUser[] = (configUsers.admin.users as AdminUser[]).map(u => ({ ...u }));

export const mockUserStore = {
  getAll: (): AdminUser[] => [..._users],

  findByCredentials: (email: string, password: string): AdminUser | undefined =>
    _users.find(u => u.email === email && u.password === password),

  add: (user: AdminUser): void => {
    _users = [..._users, user];
  },

  update: (id: string, patch: Partial<AdminUser>): void => {
    _users = _users.map(u => u.id === id ? { ...u, ...patch } : u);
  },

  remove: (id: string): void => {
    _users = _users.filter(u => u.id !== id);
  },

  updateLastLogin: (id: string): void => {
    const today = new Date().toISOString().slice(0, 10);
    _users = _users.map(u => u.id === id ? { ...u, lastLogin: today } : u);
  },
};
