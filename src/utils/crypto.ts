// 浏览器端 AES-GCM 加密工具
// 使用 Web Crypto API
// 密钥由用户主密码 + 固定 salt 派生（PBKDF2），主密码仅保存在内存中，不持久化
// 存储格式：{ iv: base64, salt: base64, ciphertext: base64 }

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 150_000;
const SALT_KEY = 'weaviate_master_salt';

/** 加密数据结构 */
export interface EncryptedData {
  iv: string;
  salt: string;
  ciphertext: string;
}

/** 判断存储的值是否为加密格式 */
export function isEncrypted(value: unknown): value is EncryptedData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.iv === 'string' && typeof v.salt === 'string' && typeof v.ciphertext === 'string';
}

// ============ 主密钥管理 ============

let masterKey: CryptoKey | null = null;

/** 主密钥是否已解锁 */
export function isUnlocked(): boolean {
  return masterKey !== null;
}

/** 锁定主密钥（清除内存中的密钥） */
export function lockMasterKey(): void {
  masterKey = null;
}

/** 获取或创建 salt（持久化到 localStorage，确保同一浏览器可重复派生同一密钥） */
function getOrCreateSalt(): Uint8Array<ArrayBuffer> {
  const existing = localStorage.getItem(SALT_KEY);
  if (existing) {
    return new Uint8Array(Uint8Array.from(atob(existing), (c) => c.charCodeAt(0)).buffer as ArrayBuffer);
  }
  const salt = new Uint8Array(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)).buffer as ArrayBuffer);
  localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)));
  return salt;
}

/** 用用户密码派生 AES-GCM 密钥 */
export async function unlockMasterKey(password: string): Promise<void> {
  const salt = getOrCreateSalt();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  masterKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ============ 工具函数 ============

function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer as ArrayBuffer);
}

// ============ 加密 / 解密 ============

/** 加密明文（需先调用 unlockMasterKey 解锁） */
export async function encrypt(plaintext: string): Promise<EncryptedData> {
  if (!masterKey) throw new Error('Master key not unlocked. Call unlockMasterKey() first.');
  const iv = new Uint8Array(crypto.getRandomValues(new Uint8Array(IV_LENGTH)).buffer as ArrayBuffer);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    masterKey,
    enc.encode(plaintext),
  );
  const salt = getOrCreateSalt();
  return {
    iv: toBase64(iv),
    salt: toBase64(salt),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/** 解密（需先调用 unlockMasterKey 解锁） */
export async function decrypt(data: EncryptedData): Promise<string> {
  if (!masterKey) throw new Error('Master key not unlocked. Call unlockMasterKey() first.');
  const iv = fromBase64(data.iv);
  const ciphertext = fromBase64(data.ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    masterKey,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}
