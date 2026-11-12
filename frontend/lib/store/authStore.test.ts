import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./authStore";
import { storage } from "../storage";

describe("initializeAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it("restores a complete persisted session", () => {
    storage.setToken("stored-token");
    storage.setUser({ id: "u1", email: "jane@example.com" });

    useAuthStore.getState().initializeAuth();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("stored-token");
  });

  it("discards a half-restored session instead of leaving it inconsistent", () => {
    storage.setToken("orphan-token");

    useAuthStore.getState().initializeAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(storage.getToken()).toBeNull();
  });
});
