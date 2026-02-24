/**
 * Input validation utilities for Convex functions
 */

// Max lengths for common fields
export const MAX_TITLE_LENGTH = 255;
export const MAX_CONTENT_LENGTH = 50 * 1024; // 50KB
export const MAX_URL_LENGTH = 2048;
export const MAX_EMAIL_LENGTH = 254;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate title length
 */
export function isValidTitle(title: string): boolean {
  return typeof title === "string" && title.length > 0 && title.length <= MAX_TITLE_LENGTH;
}

/**
 * Validate content length
 */
export function isValidContent(content: string): boolean {
  return typeof content === "string" && content.length <= MAX_CONTENT_LENGTH;
}

/**
 * Truncate string to max length
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Sanitize string by removing control characters
 */
export function sanitizeString(str: string): string {
  // Remove control characters except newlines and tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Validate and throw if invalid
 */
export function validateTitle(title: string, fieldName = "title"): void {
  if (!title || typeof title !== "string") {
    throw new Error(`${fieldName} is required`);
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`${fieldName} must be ${MAX_TITLE_LENGTH} characters or less`);
  }
}

export function validateContent(content: string, fieldName = "content"): void {
  if (typeof content !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`${fieldName} must be ${MAX_CONTENT_LENGTH / 1024}KB or less`);
  }
}

export function validateEmail(email: string): void {
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }
}

export function validateUrl(url: string, fieldName = "url"): void {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes script tags, event handlers, and dangerous attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let sanitized = html;

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, "");

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, "");

  // Remove data: URLs (can be used for XSS)
  sanitized = sanitized.replace(/data\s*:/gi, "");

  // Remove vbscript: URLs
  sanitized = sanitized.replace(/vbscript\s*:/gi, "");

  // Remove style tags (can contain expressions in older IE)
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove iframe, embed, object tags
  sanitized = sanitized.replace(/<(iframe|embed|object)\b[^>]*>.*?<\/\1>/gi, "");
  sanitized = sanitized.replace(/<(iframe|embed|object)\b[^>]*\/?>/gi, "");

  // Remove form tags
  sanitized = sanitized.replace(/<\/?form\b[^>]*>/gi, "");

  // Remove base tags (can redirect all relative URLs)
  sanitized = sanitized.replace(/<base\b[^>]*\/?>/gi, "");

  return sanitized;
}

/**
 * Sanitize plain text by escaping HTML entities
 * Use this for content that should not contain any HTML
 */
export function escapeHtml(text: string): string {
  if (!text) return "";

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Check if a string contains potentially dangerous HTML
 */
export function containsDangerousHtml(html: string): boolean {
  if (!html) return false;

  const dangerousPatterns = [
    /<script\b/i,
    /\s*on\w+\s*=/i,
    /javascript\s*:/i,
    /data\s*:/i,
    /vbscript\s*:/i,
    /<iframe\b/i,
    /<embed\b/i,
    /<object\b/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(html));
}
