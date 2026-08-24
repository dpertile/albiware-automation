import axios, { AxiosInstance, AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/index.js";
import { logger, AuditLogger, createAuditLogger } from "../utils/logger.js";
import {
  Project,
  Task,
  StaffMember,
  ProjectDate,
  Webhook,
  ApiResponse,
<<<<<<< HEAD
} from "../types/index.js";

=======
} from "../types";
>>>>>>> 2f4c447443261ae7aa08944367329317a3b22e60
/**
 * CLIENTE ALBIWARE COM SEGURANÇA ENTERPRISE
 *
 * Features:
 * - Retry automático com backoff exponencial
 * - Validação de resposta
 * - Timeout configurável
 * - Logging estruturado de cada chamada
 * - Rate limiting
 * - Tratamento de erros seguro
 */
interface RequestContext {
  automationId: string;
  operationId: string;
  dryRun: boolean;
  audit: AuditLogger;
}
export class AlbiwareClient {
  private client: AxiosInstance;
  private auditLogger: AuditLogger;
  private requestCount = 0;
  private lastRequestTime = 0;
  constructor() {
    this.auditLogger = createAuditLogger({
      automationId: "albiware-client",
      dryRun: config.dryRun,
    });
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        "X-API-KEY": config.api.key,
        "Content-Type": "application/json",
        "User-Agent": "AlbiwareAutomation/1.0.0",
      },
    });
    // Interceptor de resposta para validação
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.auditLogger.error("❌ API KEY INVÁLIDA OU EXPIRADA", error);
          process.exit(1);
        }
        throw error;
      }
    );
  }
  /**
   * AGUARDAR RATE LIMIT
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minTimeBetweenRequests = 1000 / config.rateLimiting.maxRequestsPerSecond;
    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const waitTime = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }
  /**
   * FAZER REQUISIÇÃO COM RETRY
   */
  private async makeRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    data?: any,
    context?: Partial<RequestContext>
  ): Promise<T> {
    const ctx: RequestContext = {
      automationId: context?.automationId || "api-call",
      operationId: context?.operationId || uuidv4(),
      dryRun: context?.dryRun !== false,
      audit: context?.audit || this.auditLogger,
    };
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= config.api.maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        const startTime = Date.now();
        const response = await this.client.request<ApiResponse<T>>({
          method,
          url: endpoint,
          data,
        });
        const duration = Date.now() - startTime;
        // Validar resposta
        if (!response.data) {
          throw new Error("Empty response from API");
        }
        ctx.audit.logApiCall(method, endpoint, response.status, duration);
        return response.data.data || response.data;
      } catch (error) {
        lastError = error as Error;
        const duration = Date.now();
        const httpStatus = (error as AxiosError).response?.status || 0;
        ctx.audit.logRetry(
          attempt,
          config.api.maxRetries,
          lastError.message,
          attempt < config.api.maxRetries
            ? config.api.retryBackoffMs * Math.pow(2, attempt - 1)
            : undefined
        );
        ctx.audit.logApiCall(
          method,
          endpoint,
          httpStatus,
          duration,
          lastError.message
        );
        // Não retry em erro 4xx (exceto 429 rate limit)
        if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) {
          throw lastError;
        }
        // Aguardar antes de retry
        if (attempt < config.api.maxRetries) {
          const backoffTime = config.api.retryBackoffMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }
    throw new Error(
      `Failed after ${config.api.maxRetries} attempts: ${lastError?.message}`
    );
  }
  /**
   * GET /Projects
   */
  async getProjects(
    pageSize = 50,
    context?: Partial<RequestContext>
  ): Promise<Project[]> {
    const response = await this.makeRequest<{ data: Project[] }>(
      "GET",
      `/Projects?pageSize=${pageSize}`,
      undefined,
      context
    );
    return (response as any).data || [];
  }
  /**
   * GET /Projects/{id}
   */
  async getProject(
    projectId: number,
    context?: Partial<RequestContext>
  ): Promise<Project> {
    return this.makeRequest<Project>(
      "GET",
      `/Projects/${projectId}`,
      undefined,
      context
    );
  }
  /**
   * POST /Projects/{id}/Tasks
   * CREATE TASK
   */
  async createTask(
    projectId: number,
    task: {
      name: string;
      description?: string;
      assignedToId?: number;
      dueDate?: string;
      notes?: string;
    },
    context?: Partial<RequestContext>
  ): Promise<Task> {
    if (config.dryRun && context?.dryRun !== false) {
      context?.audit?.logDryRunAction("CREATE_TASK", task.name, {
        projectId,
        ...task,
      });
      return {
        id: -1,
        identifier: "DRY-RUN",
        projectId,
        name: task.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "Not Started",
        ...task,
      };
    }
    return this.makeRequest<Task>(
      "POST",
      `/Projects/${projectId}/Tasks`,
      task,
      context
    );
  }
  /**
   * GET /Tasks
   */
  async getTasks(
    projectId: number,
    context?: Partial<RequestContext>
  ): Promise<Task[]> {
    const response = await this.makeRequest<{ data: Task[] }>(
      "GET",
      `/Tasks?projectId=${projectId}`,
      undefined,
      context
    );
    return (response as any).data || [];
  }
  /**
   * GET /Tasks/{id}
   */
  async getTask(
    taskId: number,
    context?: Partial<RequestContext>
  ): Promise<Task> {
    return this.makeRequest<Task>(
      "GET",
      `/Tasks/${taskId}`,
      undefined,
      context
    );
  }
  /**
   * PUT /Tasks/{id}
   * UPDATE TASK
   */
  async updateTask(
    taskId: number,
    updates: Partial<Task>,
    context?: Partial<RequestContext>
  ): Promise<Task> {
    if (config.dryRun && context?.dryRun !== false) {
      context?.audit?.logDryRunAction("UPDATE_TASK", `Task ${taskId}`, updates);
      return { id: taskId } as Task;
    }
    return this.makeRequest<Task>(
      "PUT",
      `/Tasks/${taskId}`,
      updates,
      context
    );
  }
  /**
   * PUT /Projects/{id}/Dates
   * UPDATE PROJECT DATES
   */
  async updateProjectDates(
    projectId: number,
    dates: { dateKey: string; dateValue: string }[],
    context?: Partial<RequestContext>
  ): Promise<void> {
    if (config.dryRun && context?.dryRun !== false) {
      context?.audit?.logDryRunAction("UPDATE_DATES", `Project ${projectId}`, {
        dates,
      });
      return;
    }
    await this.makeRequest<void>(
      "PUT",
      `/Projects/${projectId}/Dates`,
      { dates },
      context
    );
  }
  /**
   * GET /Projects/{id}/Dates
   * GET PROJECT DATES
   */
  async getProjectDates(
    projectId: number,
    context?: Partial<RequestContext>
  ): Promise<ProjectDate[]> {
    try {
      const response = await this.makeRequest<ProjectDate[]>(
        "GET",
        `/Projects/${projectId}/Dates`,
        undefined,
        context
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      // Endpoint pode não estar disponível, retornar vazio
      context?.audit?.error("Failed to get project dates", error as Error);
      return [];
    }
  }
  /**
   * GET /Staff
   */
  async getStaff(context?: Partial<RequestContext>): Promise<StaffMember[]> {
    const response = await this.makeRequest<{ data: StaffMember[] }>(
      "GET",
      `/Staff`,
      undefined,
      context
    );
    return (response as any).data || [];
  }
  /**
   * GET /Staff/{id}
   */
  async getStaffMember(
    staffId: number,
    context?: Partial<RequestContext>
  ): Promise<StaffMember> {
    return this.makeRequest<StaffMember>(
      "GET",
      `/Staff/${staffId}`,
      undefined,
      context
    );
  }
  /**
   * GET /Webhooks
   */
  async getWebhooks(
    context?: Partial<RequestContext>
  ): Promise<Webhook[]> {
    return this.makeRequest<Webhook[]>(
      "GET",
      `/Webhooks`,
      undefined,
      context
    );
  }
  /**
   * POST /Webhooks
   */
  async createWebhook(
    webhookUrl: string,
    scopes: string[],
    context?: Partial<RequestContext>
  ): Promise<Webhook> {
    if (config.dryRun && context?.dryRun !== false) {
      context?.audit?.logDryRunAction("CREATE_WEBHOOK", webhookUrl, { scopes });
      return {
        id: -1,
        webhookUrl,
        scopes,
        createdAt: new Date().toISOString(),
      };
    }
    return this.makeRequest<Webhook>(
      "POST",
      `/Webhooks`,
      { webhookUrl, scopes },
      context
    );
  }
  /**
   * DELETE /Webhooks/{id}
   */
  async deleteWebhook(
    webhookId: number,
    context?: Partial<RequestContext>
  ): Promise<void> {
    if (config.dryRun && context?.dryRun !== false) {
      context?.audit?.logDryRunAction("DELETE_WEBHOOK", `Webhook ${webhookId}`);
      return;
    }
    await this.makeRequest<void>(
      "DELETE",
      `/Webhooks/${webhookId}`,
      undefined,
      context
    );
  }
}
/**
 * EXPORTAR INSTÂNCIA SINGLETON
 */
export const albiwareClient = new AlbiwareClient();
export default albiwareClient;

