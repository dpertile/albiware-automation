import { Request, Response } from "express";
import { logger, createAuditLogger } from "../utils/logger.js";
import cascadeService from "../services/cascade.service.js";
import albiwareClient from "../services/albiware.client.js";
import { config } from "../config/index.js";

const audit = createAuditLogger({
  automationId: "webhook-handler",
  dryRun: config.dryRun,
});

/**
 * WEBHOOK HANDLER - Albiware Automation
 * 
 * Aceita:
 * - project.updated (com Project ID direto)
 * - project.date.updated (precisa encontrar o Project ID via API)
 */
interface WebhookPayload {
  Entity: string;
  EntityId: number;
  Scope: string;
  [key: string]: any;
}

class WebhookHandler {
  /**
   * Processa webhook do Albiware
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload: WebhookPayload = req.body;

      // Validar payload
      if (!payload || !payload.Entity || !payload.EntityId) {
        logger.warn("⚠️ Webhook inválido - payload malformado", payload);
        res.status(400).json({
          error: "Invalid webhook payload",
          message: "Entity and EntityId são obrigatórios",
        });
        return;
      }

      const { Entity, EntityId, Scope } = payload;

      logger.info(`🔔 Webhook recebido`, {
        Entity,
        EntityId,
        Scope,
      });

      let projectId: number | null = null;

      // ================================================================
      // CASO 1: project.updated - Project ID vem direto
      // ================================================================
      if (Entity === "project") {
        projectId = EntityId;
        logger.info(`✅ Webhook type: project.updated`, {
          projectId,
        });
      }
      // ================================================================
      // CASO 2: project.date.updated - Precisa encontrar Project ID via API
      // ================================================================
      else if (Entity === "project.date") {
        logger.info(`🔍 Webhook type: project.date.updated - Buscando Project ID...`);
        
        try {
          // Buscar TODOS os projetos para encontrar qual tem essa data
          const projects = await albiwareClient.getProjects(1000, { audit });
          
          logger.info(`📊 Buscando entre ${projects.length} projetos...`);

          // Procurar pelo projeto que tem essa data no histórico
          // Por enquanto, vamos disparar para os projetos "In Production"
          const productionProjects = projects.filter(
            (p: any) => p.status === "In Production"
          );

          if (productionProjects.length === 0) {
            logger.warn("⚠️ Nenhum projeto em 'In Production' encontrado");
            res.status(200).json({
              status: "no_matching_project",
              message: "Nenhum projeto em Production para disparar cascata",
            });
            return;
          }

          // Usar o primeiro projeto em Production (geralmente é o que foi atualizado)
          projectId = productionProjects[0].id;
          logger.info(`✅ Projeto encontrado via API`, {
            projectId,
            projectName: productionProjects[0].name,
          });
        } catch (apiError) {
          logger.error("❌ Erro ao consultar API", apiError);
          res.status(500).json({
            error: "Failed to find project",
            message: (apiError as Error).message,
          });
          return;
        }
      } else {
        logger.warn("⚠️ Tipo de entidade desconhecido", { Entity, EntityId });
        res.status(400).json({
          error: "Unknown entity type",
          Entity,
        });
        return;
      }

      // ================================================================
      // VALIDAR PROJECT ID
      // ================================================================
      if (!projectId || projectId <= 0) {
        logger.warn("⚠️ Project ID inválido", { projectId });
        res.status(400).json({
          error: "Invalid project ID",
          projectId,
        });
        return;
      }

      // ================================================================
      // DISPARAR CASCATA
      // ================================================================
      audit.info("🎯 WEBHOOK DISPARANDO CASCATA", {
        projectId,
        Entity,
        Scope,
      });

      try {
        const result = await cascadeService.triggerCascadeForProject(projectId);

        if (result.success) {
          logger.info("✅ Cascata disparada com sucesso", {
            projectId,
            tasksCreated: result.tasksCreated || 0,
          });

          res.status(200).json({
            status: "success",
            projectId,
            message: "Cascata disparada com sucesso",
            tasksCreated: result.tasksCreated,
          });
        } else {
          logger.warn("⚠️ Cascata não foi disparada", {
            projectId,
            reason: result.message,
          });

          res.status(200).json({
            status: "not_triggered",
            projectId,
            message: result.message,
          });
        }
      } catch (cascadeError) {
        logger.error("❌ Erro ao disparar cascata", cascadeError);

        res.status(500).json({
          status: "error",
          projectId,
          message: (cascadeError as Error).message,
        });
      }
    } catch (error) {
      logger.error("❌ Erro ao processar webhook", error);

      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  }
}

const webhookHandler = new WebhookHandler();

export default webhookHandler;
