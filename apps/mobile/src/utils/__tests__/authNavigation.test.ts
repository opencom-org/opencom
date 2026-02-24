import { describe, expect, it } from "vitest";
import { getAuthRoute } from "../authNavigation";

describe("getAuthRoute", () => {
  it("returns signup route for signup target", () => {
    expect(getAuthRoute("signup")).toBe("/(auth)/signup");
  });

  it("returns login route for login target", () => {
    expect(getAuthRoute("login")).toBe("/(auth)/login");
  });
});
