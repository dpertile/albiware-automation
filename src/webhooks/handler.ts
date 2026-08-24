import { Request, Response } from "express";
import { logger } from "../utils/logger.js";
import cascadeService from "../services/cascade.service.js";
import albiwareClient from "../services/albiware.client.js";

interface WebhookPayload {
  Entity: string;
  EntityId: number;
  Scope: string;
  [key: string]: any;
}

class WebhookHandler {
  async handleWebhook(req: Request, res: Response): Promise<void> {
    console.log("🔔 === WEBHOOK RECEBIDO === 🔔");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    try {
      const payload: WebhookPayload = req.body;

      console.log("📋 Payload:", payload);

      if (!payload || !payload.Entity || !payload.EntityId) {
        console.log("❌ Payload inválido!");
        logger.warn("⚠️ Payload malformado", payload);
        res.status(400).json({
          error: "Invalid webhook payload",
          message: "Entity and EntityId são obrigatórios",
        });
        return;
      }

      const { Entity, EntityId, Scope } = payload;

      console.log(`🔍 Entity: ${Entity}, EntityId: ${EntityId}, Scope: ${Scope}`);
      logger.info(`🔔 Webhook recebido`, { Entity, EntityId, Scope });

      let projectId: number | null = null;

      // CASO 1: project.updated
      if (Entity === "project") {
        projectId = EntityId;
        console.log(`✅ Tipo: project.updated, ProjectId: ${projectId}`);
        logger.info(`✅ Webhook type: project.updated`, { projectId });
      }
      // CASO 2: project.date.updated
      else if (Entity === "project.date") {
        console.log("🔍 Tipo: project.date.updated - Buscando Project ID...");
        logger.info(`🔍 Webhook type: project.date.updated`);

        try {
          console.log("📡 Chamando API para buscar projetos...");
          const projects = await albiwareClient.getProjects(1000);

          console.log(`📊 Encontrados ${projects.length} projetos`);
          logger.info(`📊 Buscando entre ${projects.length} projetos`);

          const productionProjects = projects.filter(
            (p: any) => p.status === "In Production"
          );

          console.log(`🏭 Projetos em Production: ${productionProjects.length}`);

          if (productionProjects.length === 0) {
            console.log("❌ Nenhum projeto em Production!");
            logger.warn("⚠️ Nenhum projeto em 'In Production' encontrado");
            res.status(200).json({
              status: "no_matching_project",
              message: "Nenhum projeto em Production",
            });
            return;
          }

          // Usar o projeto mais recentemente atualizado
          projectId = productionProjects[0].id;
          console.log(`✅ Projeto encontrado: ${projectId}`);
          logger.info(`✅ Projeto encontrado via API`, { projectId });
        } catch (apiError) {
          console.log("❌ Erro ao consultar API:", apiError);
          logger.error("❌ Erro ao consultar API", apiError);
          res.status(500).json({
            error: "Failed to find project",
            message: (apiError as Error).message,
          });
          return;
        }
      } else {
        console.log(`❌ Entity desconhecida: ${Entity}`);
        logger.warn("⚠️ Tipo de entidade desconhecido", { Entity });
        res.status(400).json({
          error: "Unknown entity type",
          Entity,
        });
        return;
      }

      if (!projectId || projectId <= 0) {
        console.log(`❌ Project ID inválido: ${projectId}`);
        logger.warn("⚠️ Project ID inválido", { projectId });
        res.status(400).json({
          error: "Invalid project ID",
          projectId,
        });
        return;
      }

      console.log(`🎯 Disparando cascata para project ${projectId}`);
      logger.info("🎯 WEBHOOK DISPARANDO CASCATA", { projectId, Entity, Scope });

      try {
        console.log("🚀 Chamando cascadeService...");
        const result = await cascadeService.triggerCascadeForProject(projectId);

        console.log("📊 Resultado:", result);

        if (result.success) {
          console.log("✅ SUCESSO! Cascata disparada!");
          logger.info("✅ Cascata disparada com sucesso", { projectId });

          res.status(200).json({
            status: "success",
            projectId,
            message: "Cascata disparada com sucesso",
            tasksCreated: result.tasksCreated,
          });
        } else {
          console.log("⚠️ Cascata não foi disparada:", result.message);
          logger.warn("⚠️ Cascata não foi disparada", { projectId, reason: result.message });

          res.status(200).json({
            status: "not_triggered",
            projectId,
            message: result.message,
          });
        }
      } catch (cascadeError) {
        console.log("❌ Erro ao disparar cascata:", cascadeError);
        logger.error("❌ Erro ao disparar cascata", cascadeError);

        res.status(500).json({
          status: "error",
          projectId,
          message: (cascadeError as Error).message,
        });
      }
    } catch (error) {
      console.log("❌ ERRO GERAL NO WEBHOOK:", error);
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
