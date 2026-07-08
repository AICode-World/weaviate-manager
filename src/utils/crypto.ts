// 浏览器端 AES-GCM 加密工具
// 使用 Web Crypto API，密钥由 origin 派生，确保同源可解密
// 存储格式：{ iv: base64, salt: base64, ciphertext: base64 }

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 100_000;

/** 判断存储的值是否为加密格式 */
export function isEncrypted(value: unknown): value is { iv: string; salt: string; ciphertext: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.iv === 'string' && typeof v.salt === 'string' && typeof v.ciphertext === 'string';
}

/** 从 origin 派生 AES-GCM 密钥 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // 使用 origin 作为基础种子，确保同源可解密
  const origin = typeof window !== 'undefined' ? window.location.origin : 'weaviate-manager';
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(origin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** 加密明文 */
export async function encrypt(plaintext: string): Promise<{ iv: string; salt: string; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(plaintext),
  );
  return {
    iv: toBase64(iv),
    salt: toBase64(salt),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/** 解密 */
export async function decrypt(encrypted: { iv: string; salt: string; ciphertext: string }): Promise<string> {
  const iv = fromBase64(encrypted.iv);
  const salt = fromBase64(encrypted.salt);
  const ciphertext = fromBase64(encrypted.ciphertext);
  const key = await deriveKey(salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}
