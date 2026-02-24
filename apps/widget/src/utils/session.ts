export function generateSessionId(): string {
  const stored = localStorage.getItem("opencom_session_id");
  if (stored) return stored;
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const newId = `session_${hex}`;
  localStorage.setItem("opencom_session_id", newId);
  return newId;
}
