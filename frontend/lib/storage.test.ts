import { describe, it, expect, beforeEach } from "vitest";
import { storage } from "./storage";

describe("storage.getUser", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(storage.getUser()).toBeNull();
  });

  it("round-trips a stored user", () => {
    storage.setUser({ id: "u1", email: "jane@example.com" });

    expect(storage.getUser()).toMatchObject({
      id: "u1",
      email: "jane@example.com",
    });
  });

  it("clears and ignores a corrupt stored value instead of throwing", () => {
    localStorage.setItem("authUser", "{not-json");

    expect(() => storage.getUser()).not.toThrow();
    expect(storage.getUser()).toBeNull();
    expect(localStorage.getItem("authUser")).toBeNull();
  });

  it("ignores values that parse to a non-object", () => {
    localStorage.setItem("authUser", '"just-a-string"');

    expect(storage.getUser()).toBeNull();
  });
});
