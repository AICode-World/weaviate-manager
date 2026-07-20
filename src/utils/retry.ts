/**
 * 请求重试工具
 *
 * 用法:
 *   const result = await withRetry(() => fetchObjects(client, className));
 *
 * 仅对网络错误和 5xx 服务端错误重试，不对 4xx 客户端错误重试。
 */

/** 判断错误是否可重试 */
function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // 网络错误
    if (msg.includes('network') || msg.includes('fetch')) return true;
    // 超时
    if (msg.includes('timeout') || msg.includes('aborted')) return false;
    // HTTP 5xx
    if (/\b5\d{2}\b/.test(msg)) return true;
    // 连接拒绝
    if (msg.includes('failed to fetch') || msg.includes('connection')) return true;
  }
  return false;
}

/** 延迟函数（指数退避） */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步执行
 * @param fn 要执行的异步函数
 * @param retries 重试次数（默认 2）
 * @param baseDelay 基础延迟毫秒（默认 500ms，指数退避）
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 500): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0 && isRetryable(e)) {
      await delay(baseDelay * (3 - retries)); // 500ms, 1000ms
      return withRetry(fn, retries - 1, baseDelay);
    }
    throw e;
  }
}
