/**
 * AES-GCM encryption/decryption for webhook signing secrets.
 *
 * Env var: AUTOMATION_WEBHOOK_SECRET_ENCRYPTION_KEY — base64-encoded 32-byte key.
 * Format: base64(iv) + "." + base64(ciphertext+tag)
 */

function getEncryptionKey(): string {
  const key = process.env.AUTOMATION_WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "AUTOMATION_WEBHOOK_SECRET_ENCRYPTION_KEY env var is not set"
    );
  }
  return key;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const rawKey = base64ToBytes(keyB64);
  return crypto.subtle.importKey(
    "raw",
    rawKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptWebhookSecret(plaintext: string): Promise<string> {
  const keyB64 = getEncryptionKey();
  const key = await importKey(keyB64);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded.buffer as ArrayBuffer
  );

  return bytesToBase64(iv) + "." + bytesToBase64(new Uint8Array(ciphertext));
}

export async function decryptWebhookSecret(
  ciphertextStr: string
): Promise<string> {
  const keyB64 = getEncryptionKey();
  const key = await importKey(keyB64);

  const [ivB64, ctB64] = ciphertextStr.split(".");
  if (!ivB64 || !ctB64) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ctB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  return new TextDecoder().decode(decrypted);
}
