const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function safeOpenUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return false;
    }

    window.open(parsed.toString(), "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}
