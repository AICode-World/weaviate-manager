/**
 * 媒体文件工具 — base64 / data URI / 文件类型检测
 *
 * Weaviate 存储裸 base64（不带 data: 前缀），
 * 前端展示时需要补全 data URI；编辑时需要去掉前缀再存回。
 */

/** 将 File 对象转为 data URI（base64 带前缀） */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 检测 base64 的 MIME 类型 */
export function getMediaType(str: string): 'image' | 'video' | 'audio' | null {
  const m = str.match(/^data:(image|video|audio)\//);
  if (m) return m[1] as 'image' | 'video' | 'audio';
  if (str.startsWith('/9j/') || str.startsWith('iVBOR') || str.startsWith('R0lGOD') || str.startsWith('UklGR')) return 'image';
  return null;
}

/** 裸 base64 → data URI（自动检测 mime 类型补前缀） */
export function toDataUri(raw: string): string {
  if (raw.startsWith('data:')) return raw;
  const mime = raw.startsWith('/9j/') ? 'image/jpeg'
    : raw.startsWith('iVBOR') ? 'image/png'
    : raw.startsWith('R0lGOD') ? 'image/gif'
    : raw.startsWith('UklGR') ? 'image/webp'
    : 'image/jpeg';
  return `data:${mime};base64,${raw}`;
}

/** data URI → 裸 base64（去掉 data:...;base64, 前缀，供 Weaviate API 存储用） */
export function stripDataUri(uri: string): string {
  const idx = uri.indexOf(',');
  return idx >= 0 ? uri.slice(idx + 1) : uri;
}

/** 判断值是否为 Base64 图片（支持裸 base64 和 data URI） */
export function isBase64Image(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (v.startsWith('data:image/')) return true;
  return v.startsWith('/9j/') || v.startsWith('iVBOR') || v.startsWith('R0lGOD') || v.startsWith('UklGR');
}
