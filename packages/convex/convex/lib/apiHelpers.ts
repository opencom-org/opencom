export function parsePaginationParams(url: URL): {
  cursor: string | null;
  limit: number;
  updatedSince: number | null;
} {
  const cursor = url.searchParams.get("cursor");
  const limitStr = url.searchParams.get("limit");
  const updatedSinceStr = url.searchParams.get("updatedSince");

  const limit = limitStr ? Math.min(Math.max(Number.parseInt(limitStr, 10) || 20, 1), 100) : 20;
  const updatedSince = updatedSinceStr ? Number.parseInt(updatedSinceStr, 10) || null : null;

  return { cursor, limit, updatedSince };
}

export function buildPaginatedResponse<T>(
  items: T[],
  limit: number,
  cursorExtractor?: (item: T) => string
): { data: T[]; nextCursor: string | null; hasMore: boolean } {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && data.length > 0 && cursorExtractor
      ? cursorExtractor(data[data.length - 1])
      : null;

  return { data, nextCursor, hasMore };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
