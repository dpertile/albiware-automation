import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { config } from "../config/index.js";
import { createAuditLogger } from "../utils/logger.js";
import cascadeService from "../services/cascade.service.js";
import auditService from "../services/audit.service.js";
import {
  WebhookPayload,
  AutomationEventType,
  AuditActionType,
} from "../types";
/**
 * HANDLER DE WEBHOOKS
 *
 * Recebe eventos do Albiware e dispara a automação
 * 
 * Eventos suportados:
 * - project.created -> Disparar cascata
 * - task.completed -> Processar conclusão (trigger próxima fase)
 * - project.status.changed -> Monitorar mudanças
 * - project.date.updated -> Detectar conflitos com Zapier
 *
 * Segurança:
 * - Validar assinatura de webhook (se disponível)
 * - Deduplicação (não processar 2x)
 * - Timeout + retry
 * - Logging completo
 */
export class WebhookHandler {
  private audit = createAuditLogger({
    automationId: "webhook-handler",
    dryRun: config.dryRun,
  });
  private processedWebhooks = new Map<string, Date>(); // Para deduplicação
  constructor() {
    // Limpar cache de webhooks processados a cada 1 hora
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      for (const [key, date] of this.processedWebhooks) {
        if (date < oneHourAgo) {
          this.processedWebhooks.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }
  /**
   * HANDLER PRINCIPAL DE WEBHOOK
   */
  async handleWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    const webhookId = uuidv4();
    const startTime = Date.now();
    try {
      this.audit.info("🪝 WEBHOOK RECEBIDO", {
        webhookId,
        method: req.method,
        path: req.path,
      });
      // 1. Validar que é POST
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      // 2. Validar payload
      if (!req.body) {
        res.status(400).json({ error: "No payload" });
        return;
      }
      // 3. Extrair dados
      const { eventType, projectId, data } = req.body;
      // 4. Validar campos obrigatórios
      if (!eventType || !projectId) {
        this.audit.warn("⚠️  WEBHOOK INVÁLIDO - Campos faltando", {
          webhookId,
          hasEventType: !!eventType,
          hasProjectId: !!projectId,
        });
        res.status(400).json({ error: "Missing eventType or projectId" });
        return;
      }
      // 5. Deduplicar (evitar processar 2x o mesmo webhook)
      const dedupeKey = `${projectId}:${eventType}:${JSON.stringify(data)}`;
      if (this.processedWebhooks.has(dedupeKey)) {
        this.audit.info("↩️  WEBHOOK DUPLICADO (IGNORANDO)", {
          webhookId,
          projectId,
          eventType,
        });
        res.status(200).json({ status: "duplicate", webhookId });
        return;
      }
      // Marcar como processado
      this.processedWebhooks.set(dedupeKey, new Date());
      // 6. Despachar para handler apropriado
      let result: any;
      switch (eventType) {
        case "project.created":
          result = await this.handleProjectCreated(projectId, data, webhookId);
          break;
        case "task.completed":
          result = await this.handleTaskCompleted(projectId, data, webhookId);
          break;
        case "project.date.updated":
          result = await this.handleDateUpdated(projectId, data, webhookId);
          break;
        case "project.status.changed":
          result = await this.handleStatusChanged(projectId, data, webhookId);
          break;
        default:
          this.audit.info("ℹ️  EVENTO NÃO TRATADO", {
            webhookId,
            projectId,
            eventType,
          });
          res.status(200).json({ status: "ignored", webhookId });
          return;
      }
      const duration = Date.now() - startTime;
      // Logar resultado
      await auditService.logAction({
        timestamp: new Date(),
        automationId: "webhook-handler",
        userId: "webhook",
        action: "WEBHOOK_PROCESSED" as any,
        projectId,
        success: result.success,
        error: result.error,
        dryRun: config.dryRun,
        sourceWebhook: webhookId,
        duration,
        metadata: {
          eventType,
          result,
        },
      });
      // Responder ao webhook
      res.status(200).json({
        status: "success",
        webhookId,
        projectId,
        eventType,
        duration,
        result,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.audit.error("❌ ERRO AO PROCESSAR WEBHOOK", error as Error, {
        webhookId,
        duration,
      });
      res.status(500).json({
        error: (error as Error).message,
        webhookId,
      });
    }
  }
  /**
   * EVENTO: Projeto Criado
   * → Disparar cascata (Fase 1)
   */
  private async handleProjectCreated(
    projectId: number,
    data: any,
    webhookId: string
  ): Promise<{ success: boolean; error?: string; action?: string }> {
    try {
      this.audit.info("🆕 PROJETO CRIADO - DISPARANDO CASCATA", {
        webhookId,
        projectId,
        projectName: data?.projectName,
      });
      const result = await cascadeService.triggerCascadeForProject(projectId);
      return {
        success: result.success,
        error: result.error,
        action: "cascade_triggered",
      };
    } catch (error) {
      this.audit.error(
        "Erro ao processar project.created",
        error as Error,
        { webhookId, projectId }
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  /**
   * EVENTO: Tarefa Concluída
   * → Processar conclusão (pode disparar próxima fase)
   */
  private async handleTaskCompleted(
    projectId: number,
    data: any,
    webhookId: string
  ): Promise<{ success: boolean; error?: string; action?: string }> {
    try {
      const taskName = data?.taskName;
      if (!taskName) {
        return {
          success: false,
          error: "Missing taskName in webhook data",
        };
      }
      this.audit.info("✅ TAREFA CONCLUÍDA - PROCESSANDO", {
        webhookId,
        projectId,
        taskName,
      });
      const result = await cascadeService.processTaskCompletion(
        projectId,
        taskName,
        webhookId
      );
      return {
        success: result.success,
        error: result.error,
        action: "task_completion_processed",
      };
    } catch (error) {
      this.audit.error(
        "Erro ao processar task.completed",
        error as Error,
        { webhookId, projectId }
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  /**
   * EVENTO: Data de Projeto Atualizada
   * → Detectar conflito com Zapier
   */
  private async handleDateUpdated(
    projectId: number,
    data: any,
    webhookId: string
  ): Promise<{ success: boolean; error?: string; action?: string }> {
    try {
      const dateKey = data?.dateKey;
      const dateValue = data?.dateValue;
      const sourceId = data?.sourceId;
      this.audit.info("📅 DATA ATUALIZADA - VERIFICANDO CONFLITO", {
        webhookId,
        projectId,
        dateKey,
        sourceId,
      });
      // Verificar se veio de fonte externa (Zapier)
      if (sourceId && sourceId !== config.isolation.automationOwner) {
        this.audit.warn("⚠️  DATA ATUALIZADA POR FONTE EXTERNA", {
          webhookId,
          projectId,
          dateKey,
          source: sourceId,
        });
        // Logar possível conflito
        await auditService.logConflict({
          timestamp: new Date(),
          projectId,
          automationAction: "UPDATE_DATE" as AuditActionType,
          expectedWebhook: 15802, // Zapier ID
          actualWebhooksFired: [15802],
          conflictType: "data_mismatch",
          description: `Date "${dateKey}" was updated by external source (${sourceId})`,
          resolved: false,
        });
        return {
          success: true,
          action: "external_date_update_logged",
        };
      }
      return {
        success: true,
        action: "date_update_processed",
      };
    } catch (error) {
      this.audit.error(
        "Erro ao processar project.date.updated",
        error as Error,
        { webhookId, projectId }
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  /**
   * EVENTO: Status de Projeto Mudou
   * → Monitorar mudanças
   */
  private async handleStatusChanged(
    projectId: number,
    data: any,
    webhookId: string
  ): Promise<{ success: boolean; error?: string; action?: string }> {
    try {
      const oldStatus = data?.oldStatus;
      const newStatus = data?.newStatus;
      this.audit.info("🔄 STATUS DO PROJETO MUDOU", {
        webhookId,
        projectId,
        oldStatus,
        newStatus,
      });
      return {
        success: true,
        action: "status_change_logged",
      };
    } catch (error) {
      this.audit.error(
        "Erro ao processar project.status.changed",
        error as Error,
        { webhookId, projectId }
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  /**
   * HEALTH CHECK PARA WEBHOOKS
   */
  handleHealth(req: Request, res: Response): void {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: config.environment,
      dryRun: config.dryRun,
      processedWebhooks: this.processedWebhooks.size,
    });
  }
  /**
   * OBTER ESTATÍSTICAS DE WEBHOOKS
   */
  async handleStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await auditService.getStatistics(24);
      res.status(200).json({
        ...stats,
        processedWebhooksInMemory: this.processedWebhooks.size,
      });
    } catch (error) {
      res.status(500).json({
        error: (error as Error).message,
      });
    }
  }
}
/**
 * EXPORTAR INSTÂNCIA SINGLETON
 */
export const webhookHandler = new WebhookHandler();
export default webhookHandler;
