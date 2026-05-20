import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem("poiro_token", token);
    localStorage.setItem("poiro_user", JSON.stringify(user));
    set({ user, token });
  },
  clearAuth: () => {
    localStorage.removeItem("poiro_token");
    localStorage.removeItem("poiro_user");
    set({ user: null, token: null });
  },
  hydrate: () => {
    const token = localStorage.getItem("poiro_token");
    const userStr = localStorage.getItem("poiro_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token });
      } catch {}
    }
  },
}));
