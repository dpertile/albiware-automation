import express, { Express, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { config, logConfigSummary } from "./config/index.js";
import { logger, createAuditLogger } from "./utils/logger.js";
import albiwareClient from "./services/albiware.client.js";
import cascadeService from "./services/cascade.service.js";
import auditService from "./services/audit.service.js";
import validationService from "./services/validation.service.js";
import webhookHandler from "./webhooks/handler.js";
/**
 * APLICAÇÃO EXPRESS - ALBIWARE AUTOMATION
 *
 * Endpoints:
 * - GET  /health - Health check
 * - POST /webhooks - Receber webhooks do Albiware
 * - GET  /api/projects/:id - Info do projeto
 * - POST /api/trigger - Disparar cascata manualmente
 * - GET  /api/audit/logs - Logs de auditoria
 * - GET  /api/stats - Estatísticas
 */
let app: Express;
let server: any;
const audit = createAuditLogger({
  automationId: "express-server",
  dryRun: config.dryRun,
});
/**
 * INICIALIZAR APLICAÇÃO
 */
async function initializeApp(): Promise<Express> {
  logger.info("🚀 Iniciando aplicação...");
  // Exibir configuração
  logConfigSummary();
  // Criar app Express
  const app = express();
  // ================================================================
  // MIDDLEWARE
  // ================================================================
  // Parse JSON
  app.use(express.json());
  // Logging de requisições
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = uuidv4();
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
      });
    });
    next();
  });
  // Error handling
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error("Unhandled error", err);
    res.status(500).json({
      error: err.message || "Internal server error",
    });
  });
  // ================================================================
  // ROTAS
  // ================================================================
  /**
   * GET /health
   * Health check da aplicação
   */
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: config.environment,
      dryRun: config.dryRun,
      uptime: process.uptime(),
      version: "1.0.0",
    });
  });
  /**
   * POST /webhooks
   * Receber webhooks do Albiware
   */
  app.post("/webhooks", async (req: Request, res: Response) => {
    await webhookHandler.handleWebhook(req, res);
  });
  /**
   * GET /api/projects/:projectId
   * Obter info do projeto
   */
  app.get("/api/projects/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ error: "Invalid project ID" });
        return;
      }
      const project = await albiwareClient.getProject(projectId, {
        audit,
      });
      res.status(200).json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error("Error fetching project", error);
      res.status(500).json({
        error: (error as Error).message,
      });
    }
  });
  /**
   * POST /api/trigger
   * Disparar cascata manualmente
   */
  app.post("/api/trigger", async (req: Request, res: Response) => {
    try {
      const { projectId } = req.body;
      if (!projectId) {
        res.status(400).json({ error: "Missing projectId" });
        return;
      }
      audit.info("🎯 DISPARAR CASCATA MANUALMENTE", { projectId });
      const result = await cascadeService.triggerCascadeForProject(projectId);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error("Error triggering cascade", error);
      res.status(500).json({
        error: (error as Error).message,
      });
    }
  });
  /**
   * GET /api/audit/logs
   * Obter logs de auditoria
   */
  app.get(
    "/api/audit/logs",
    async (req: Request, res: Response) => {
      try {
        const {
          projectId,
          action,
          limit = 50,
          offset = 0,
          errors = false,
        } = req.query;
        const logs = await auditService.getLogs({
          projectId: projectId ? parseInt(projectId as string, 10) : undefined,
          action: action as any,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
          onlyErrors: errors === "true",
        });
        res.status(200).json({
          success: true,
          data: logs,
          count: logs.length,
        });
      } catch (error) {
        logger.error("Error fetching audit logs", error);
        res.status(500).json({
          error: (error as Error).message,
        });
      }
    }
  );
  /**
   * GET /api/conflicts
   * Obter conflitos detectados
   */
  app.get(
    "/api/conflicts",
    async (req: Request, res: Response) => {
      try {
        const { projectId, resolved } = req.query;
        const conflicts = await auditService.getConflicts(
          projectId ? parseInt(projectId as string, 10) : undefined,
          resolved !== undefined ? resolved === "true" : undefined
        );
        res.status(200).json({
          success: true,
          data: conflicts,
          count: conflicts.length,
        });
      } catch (error) {
        logger.error("Error fetching conflicts", error);
        res.status(500).json({
          error: (error as Error).message,
        });
      }
    }
  );
  /**
   * GET /api/stats
   * Estatísticas
   */
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const { hours = 24 } = req.query;
      const stats = await auditService.getStatistics(
        parseInt(hours as string, 10)
      );
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Error fetching stats", error);
      res.status(500).json({
        error: (error as Error).message,
      });
    }
  });
  /**
   * GET /api/cascade/config
   * Obter configuração de cascata
   */
  app.get(
    "/api/cascade/config",
    (req: Request, res: Response) => {
      const cascadeConfig = cascadeService.getConfiguration();
      res.status(200).json({
        success: true,
        data: {
          phases: cascadeConfig.phases.map((p) => ({
            phaseNumber: p.phaseNumber,
            projectStatus: p.projectStatus,
            taskCount: p.tasks.length,
            tasks: p.tasks.map((t) => ({
              name: t.name,
              description: t.description,
              role: t.assignedToRole,
              dateKey: t.dateKeyToUpdate,
            })),
          })),
        },
      });
    }
  );
  /**
   * 404 Handler
   */
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "Not found",
      path: req.path,
    });
  });
  // ================================================================
  // INICIALIZAR BANCO DE DADOS
  // ================================================================
  try {
    logger.info("📦 Inicializando banco de dados...");
    await auditService.initialize();
    logger.info("✅ Banco de dados inicializado");
  } catch (error) {
    logger.error("❌ Erro ao inicializar banco de dados", error);
    throw error;
  }
  // ================================================================
  // TESTAR CONEXÃO COM API ALBIWARE
  // ================================================================
  try {
    logger.info("🔌 Testando conexão com Albiware...");
    const projects = await albiwareClient.getProjects(1, { audit });
    logger.info("✅ Conexão com Albiware OK", {
      projectsAvailable: projects.length,
    });
  } catch (error) {
    logger.error("❌ Erro ao conectar com Albiware", error);
    throw error;
  }
  // ================================================================
  // LISTAR WEBHOOKS CONHECIDOS
  // ================================================================
  try {
    logger.info("🪝 Verificando webhooks conhecidos...");
    const webhooks = await albiwareClient.getWebhooks({ audit });
    const activeWebhooks = webhooks.filter((w) =>
      config.webhooks.knownWebhookIds.includes(w.id)
    );
    if (activeWebhooks.length > 0) {
      logger.info("✅ Webhooks ativos detectados:", {
        webhooks: activeWebhooks.map((w) => ({
          id: w.id,
          scopes: w.scopes,
        })),
      });
    } else {
      logger.warn("⚠️  Nenhum webhook conhecido ativo");
    }
  } catch (error) {
    logger.warn("Aviso ao verificar webhooks", error);
  }
  return app;
}
/**
 * INICIAR SERVIDOR
 */
async function startServer(): Promise<void> {
  try {
    app = await initializeApp();
    const port = parseInt(process.env.SERVER_PORT || "3000");
    const host = process.env.SERVER_HOST || "0.0.0.0";
    server = app.listen(port, host as any, () => {
      logger.info(`🎉 SERVIDOR INICIADO SUCESSO`);
      logger.info(`   Host: ${host}`);
      logger.info(`   Porta: ${port}`);
      logger.info(`   URL: http://localhost:${port}`);
      logger.info(`   Health: http://localhost:${port}/health`);
      logger.info(`   Webhooks: http://localhost:${port}/webhooks`);
      logger.info("");
      logger.info("📝 Comandos úteis:");
      logger.info("  - Ver logs: curl http://localhost:" + port + "/api/audit/logs");
      logger.info("  - Ver stats: curl http://localhost:" + port + "/api/stats");
      logger.info("  - Disparar cascata: curl -X POST http://localhost:" + port + "/api/trigger -d '{\\\"projectId\\\": 999}'");
      logger.info("");
    });
  } catch (error) {
    logger.error("❌ ERRO AO INICIAR SERVIDOR", error);
    process.exit(1);
  }
}
/**
 * GRACEFUL SHUTDOWN
 */
async function gracefulShutdown(): Promise<void> {
  logger.info("🛑 Encerrando aplicação...");
  if (server) {
    server.close(async () => {
      logger.info("✅ Servidor encerrado");
      await auditService.close();
      process.exit(0);
    });
    // Forçar shutdown após 30s
    setTimeout(() => {
      logger.error("❌ Forçando shutdown após timeout");
      process.exit(1);
    }, 30000);
  }
}
// Handlers de sinal
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
/**
 * INICIAR APLICAÇÃO
 */
startServer().catch((error) => {
  logger.error("Fatal error", error);
  process.exit(1);
});
// Exportar app para testes
export { app, initializeApp };
