// 统一错误处理与上报
// 后续可扩展接入 Sentry / Datadog / 自定义日志服务

export interface AppError {
  code: string;
  message: string;
  /** i18n key，如果设置则组件应优先用 t(message) 翻译 */
  i18nKey?: string;
  /** i18n 参数 */
  i18nParams?: Record<string, string | number>;
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

/** 根据 HTTP 状态码创建错误（返回 i18n key，组件用 t() 翻译） */
export function httpError(status: number, body?: unknown, context?: string): AppError {
  const detail = typeof body === 'object' ? JSON.stringify(body) : undefined;
  const i18nKey = `error.http.${status}`;
  const i18nParams = { status, context: context ?? '' };
  // fallback message (for non-i18n contexts like console)
  const fallbackMessages: Record<number, string> = {
    400: `Bad request (${status})`,
    401: `Authentication failed (${status})`,
    403: `Forbidden (${status})`,
    404: `Not found (${status})`,
    429: `Too many requests (${status})`,
    500: `Internal server error (${status})`,
    502: `Bad gateway (${status})`,
    503: `Service unavailable (${status})`,
  };
  return {
    code: `HTTP_${status}`,
    message: fallbackMessages[status] ?? `Request failed (${status})`,
    i18nKey,
    i18nParams,
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

/**
 * toast 友好的错误消息提取
 * @param error 任意错误
 * @param t 可选的 i18n 翻译函数，传入则尝试翻译 i18nKey
 */
export function userFriendlyMessage(error: unknown, t?: (key: string, params?: Record<string, string | number>) => string): string {
  if (error instanceof AppErrorImpl) {
    if (error.i18nKey && t) return t(error.i18nKey, error.i18nParams);
    return error.message;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return t ? t('error.default') : 'Operation failed';
}

/** 内部类用于 instanceof 检测 */
class AppErrorImpl extends Error implements AppError {
  code: string;
  i18nKey?: string;
  i18nParams?: Record<string, string | number>;
  detail?: string;
  timestamp: number;

  constructor(appError: AppError) {
    super(appError.message);
    this.code = appError.code;
    this.i18nKey = appError.i18nKey;
    this.i18nParams = appError.i18nParams;
    this.detail = appError.detail;
    this.timestamp = appError.timestamp;
  }
}
