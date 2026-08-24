import pino from "pino";
import { config } from "../config/index.js";
/**
 * LOGGER CENTRALIZADO COM PINO
 * Garante que todas as operações sejam registradas de forma estruturada
 */
const pinoConfig = {
  level: config.environment === "production" ? "info" : "debug",
  transport:
    config.environment === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
            messageFormat: "{levelLabel} - {msg}",
          },
        }
      : undefined,
};
export const logger = pino(pinoConfig);
/**
 * WRAPPER PARA LOGGING DE AUDITORIA
 * Cada ação importante é logada com contexto completo
 */
export interface AuditContext {
  automationId: string;
  projectId?: number;
  projectName?: string;
  taskId?: number;
  taskName?: string;
  dryRun: boolean;
  userId?: string;
}
export class AuditLogger {
  constructor(private context: AuditContext) {}
  info(message: string, data?: Record<string, any>) {
    logger.info(
      {
        ...this.context,
        ...data,
      },
      message
    );
  }
  warn(message: string, data?: Record<string, any>) {
    logger.warn(
      {
        ...this.context,
        ...data,
      },
      message
    );
  }
  error(message: string, error?: Error, data?: Record<string, any>) {
    logger.error(
      {
        ...this.context,
        error: error?.message,
        stack: error?.stack,
        ...data,
      },
      message
    );
  }
  debug(message: string, data?: Record<string, any>) {
    logger.debug(
      {
        ...this.context,
        ...data,
      },
      message
    );
  }
  /**
   * LOG ESTRUTURADO DE AÇÕES DE API
   */
  logApiCall(
    method: string,
    endpoint: string,
    status: number,
    duration: number,
    error?: string
  ) {
    const level = status >= 400 ? "error" : status >= 300 ? "warn" : "info";
    const logFn = logger[level as keyof typeof logger] as any;
    logFn(
      {
        ...this.context,
        method,
        endpoint,
        status,
        durationMs: duration,
        ...(error && { error }),
      },
      `API Call: ${method} ${endpoint}`
    );
  }
  /**
   * LOG DE VALIDAÇÃO
   */
  logValidation(
    resource: "task" | "date" | "project",
    resourceId: string | number,
    valid: boolean,
    errors?: string[]
  ) {
    this.info(`${resource} validation: ${valid ? "✅ PASSED" : "❌ FAILED"}`, {
      resource,
      resourceId,
      valid,
      ...(errors && { validationErrors: errors }),
    });
  }
  /**
   * LOG DE CONFLITO
   */
  logConflict(
    type: string,
    description: string,
    webhooksTriggered?: number[]
  ) {
    this.warn(`⚠️ CONFLICT DETECTED: ${type}`, {
      conflictType: type,
      description,
      ...(webhooksTriggered && { webhooksTriggered }),
    });
  }
  /**
   * LOG DE OPERAÇÃO EM DRY-RUN
   */
  logDryRunAction(action: string, resource: string, details?: Record<string, any>) {
    this.info(`[DRY-RUN] ${action} - ${resource}`, {
      mode: "dry-run",
      action,
      resource,
      ...details,
    });
  }
  /**
   * LOG DE RETRY
   */
  logRetry(
    attempt: number,
    maxAttempts: number,
    error: string,
    nextRetryIn?: number
  ) {
    const level = attempt === maxAttempts ? "error" : "warn";
    const logFn = logger[level] as any;
    logFn(
      {
        ...this.context,
        attempt,
        maxAttempts,
        error,
        nextRetryInMs: nextRetryIn,
      },
      `Retry ${attempt}/${maxAttempts}`
    );
  }
}
/**
 * EXPORTAR FACTORY PARA CRIAR AUDIT LOGGERS
 */
export function createAuditLogger(context: AuditContext): AuditLogger {
  return new AuditLogger(context);
}
export default logger;
