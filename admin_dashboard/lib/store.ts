import { create } from "zustand";
import { clearSession, getStoredUser, saveSession, User } from "./api";

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: "admin" | "lecturer" | "hod" | null;
  setUser: (user: User) => void;
  login: (access: string, refresh: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: null,

  setUser: (user: User) => {
    const groups = user.groups.map((g) => g.toLowerCase());
    let role: AuthState["role"] = null;
    if (groups.includes("hod")) role = "hod";
    else if (groups.includes("lecturer")) role = "lecturer";
    else if (user.is_staff || user.is_superuser) role = "admin";
    set({ user, isAuthenticated: true, role, isLoading: false });
  },

  login: (access: string, refresh: string, user: User) => {
    saveSession(access, refresh, user);
    const groups = user.groups.map((g) => g.toLowerCase());
    let role: AuthState["role"] = null;
    if (groups.includes("hod")) role = "hod";
    else if (groups.includes("lecturer")) role = "lecturer";
    else if (user.is_staff || user.is_superuser) role = "admin";
    set({ user, isAuthenticated: true, role, isLoading: false });
  },

  logout: () => {
    clearSession();
    set({ user: null, isAuthenticated: false, role: null, isLoading: false });
  },

  hydrate: () => {
    const user = getStoredUser();
    if (user) {
      const groups = user.groups.map((g) => g.toLowerCase());
      let role: AuthState["role"] = null;
      if (groups.includes("hod")) role = "hod";
      else if (groups.includes("lecturer")) role = "lecturer";
      else if (user.is_staff || user.is_superuser) role = "admin";
      set({ user, isAuthenticated: true, role, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },
}));
