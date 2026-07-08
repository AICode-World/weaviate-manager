// 统一错误处理与上报
// 后续可扩展接入 Sentry / Datadog / 自定义日志服务

export interface AppError {
  code: string;
  message: string;
  detail?: string;
  timestamp: number;
}

/** 将任意错误包装为 AppError */
export function wrapError(error: unknown, context: string): AppError {
  if (error instanceof Error) {
    return {
      code: 'INTERNAL',
      message: `[${context}] ${error.message}`,
      detail: error.stack,
      timestamp: Date.now(),
    };
  }
  return {
    code: 'INTERNAL',
    message: `[${context}] ${String(error)}`,
    timestamp: Date.now(),
  };
}

/** 根据 HTTP 状态码创建错误 */
export function httpError(status: number, body?: unknown, context?: string): AppError {
  const detail = typeof body === 'object' ? JSON.stringify(body) : undefined;
  const prefix = context ? `[${context}] ` : '';
  const messages: Record<number, string> = {
    400: `${prefix}请求参数错误 (400)`,
    401: `${prefix}认证失败，请检查 API Key (401)`,
    403: `${prefix}无权限访问 (403)`,
    404: `${prefix}资源不存在 (404)`,
    429: `${prefix}请求过于频繁，请稍后重试 (429)`,
    500: `${prefix}服务器内部错误 (500)`,
    502: `${prefix}网关错误 (502)`,
    503: `${prefix}服务暂时不可用 (503)`,
  };
  return {
    code: `HTTP_${status}`,
    message: messages[status] ?? `${prefix}请求失败 (${status})`,
    detail,
    timestamp: Date.now(),
  };
}

/** 上报错误（当前为 console.error，后续可接入 Sentry） */
export function reportError(error: AppError): void {
  console.error(`[${error.code}] ${error.message}`, error.detail ?? '');
  // TODO: 接入 Sentry
  // Sentry.captureException(new Error(error.message), {
  //   tags: { code: error.code },
  //   extra: { detail: error.detail },
  // });
}

/** toast 友好的错误消息提取 */
export function userFriendlyMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '操作失败，请稍后重试';
}
