export type AuthRouteTarget = "login" | "signup";

export function getAuthRoute(target: AuthRouteTarget): "/(auth)/login" | "/(auth)/signup" {
  return target === "login" ? "/(auth)/login" : "/(auth)/signup";
}
