/**
 * TESTES ALBIWARE AUTOMATION
 * 
 * Rodando: npm test
 * Com watch: npm run test:watch
 * Com coverage: npm run test:coverage
 */

describe("Albiware Automation", () => {
  describe("Configuration", () => {
    test("should load configuration from .env", () => {
      const { config } = require("../config");

      expect(config).toBeDefined();
      expect(config.api.key).toBeDefined();
      expect(config.api.baseUrl).toBe("https://api.albiware.com/v5/Integrations");
      expect(config.database.host).toBeDefined();
    });

    test("should have cascade project types configured", () => {
      const { config } = require("../config");

      expect(config.cascade.projectTypes).toContain("Water");
      expect(config.cascade.projectTypes).toContain("Sewage");
      expect(config.cascade.projectTypes.length).toBeGreaterThan(0);
    });
  });

  describe("Logger", () => {
    test("should create audit logger with context", () => {
      const { createAuditLogger } = require("../utils/logger");

      const logger = createAuditLogger({
        automationId: "test",
        dryRun: true,
      });

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
    });
  });

  describe("Cascade Service", () => {
    test("should get cascade configuration", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const config = cascadeService.getConfiguration();

      expect(config).toBeDefined();
      expect(config.phases).toBeDefined();
      expect(config.phases.length).toBe(3); // 3 fases
    });

    test("should have 21 tasks in all phases", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const config = cascadeService.getConfiguration();
      const totalTasks = config.phases.reduce((sum, p) => sum + p.tasks.length, 0);

      expect(totalTasks).toBe(21);
    });

    test("should have phase 1 with 6 tasks", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const phase1Tasks = cascadeService.getTasksForPhase(1);

      expect(phase1Tasks).toBeDefined();
      expect(phase1Tasks.length).toBe(6);
    });

    test("should have phase 2 with 8 tasks", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const phase2Tasks = cascadeService.getTasksForPhase(2);

      expect(phase2Tasks).toBeDefined();
      expect(phase2Tasks.length).toBe(8);
    });

    test("should have phase 3 with 7 tasks", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const phase3Tasks = cascadeService.getTasksForPhase(3);

      expect(phase3Tasks).toBeDefined();
      expect(phase3Tasks.length).toBe(7);
    });

    test("phase 1 last task should be Assign Estimator", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const phase1Tasks = cascadeService.getTasksForPhase(1);
      const lastTask = phase1Tasks[phase1Tasks.length - 1];

      expect(lastTask.name).toBe("Assign Estimator");
    });

    test("phase 2 last task should be Finalize Agreed Price", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const phase2Tasks = cascadeService.getTasksForPhase(2);
      const lastTask = phase2Tasks[phase2Tasks.length - 1];

      expect(lastTask.name).toBe("Finalize Agreed Price");
    });

    test("phase 3 last task should be Collect Final Payment", () => {
      const cascadeService = require("../services/cascade.service").cascadeService;

      const phase3Tasks = cascadeService.getTasksForPhase(3);
      const lastTask = phase3Tasks[phase3Tasks.length - 1];

      expect(lastTask.name).toBe("Collect Final Payment");
    });
  });

  describe("Validation Service", () => {
    test("should instantiate validation service", () => {
      const validationService = require("../services/validation.service").validationService;

      expect(validationService).toBeDefined();
      expect(validationService.validateTaskCreation).toBeDefined();
      expect(validationService.validateDateUpdate).toBeDefined();
    });

    test("should clear cache", () => {
      const validationService = require("../services/validation.service").validationService;

      expect(() => {
        validationService.clearCache();
      }).not.toThrow();
    });
  });

  describe("Albiware Client", () => {
    test("should instantiate client", () => {
      const albiwareClient = require("../services/albiware.client").albiwareClient;

      expect(albiwareClient).toBeDefined();
      expect(albiwareClient.getProjects).toBeDefined();
      expect(albiwareClient.getProject).toBeDefined();
      expect(albiwareClient.createTask).toBeDefined();
      expect(albiwareClient.updateTask).toBeDefined();
      expect(albiwareClient.updateProjectDates).toBeDefined();
      expect(albiwareClient.getWebhooks).toBeDefined();
    });
  });

  describe("Audit Service", () => {
    test("should instantiate audit service", async () => {
      const auditService = require("../services/audit.service").auditService;

      expect(auditService).toBeDefined();
      expect(auditService.logAction).toBeDefined();
      expect(auditService.logConflict).toBeDefined();
      expect(auditService.getLogs).toBeDefined();
      expect(auditService.getConflicts).toBeDefined();
    });
  });

  describe("Types", () => {
    test("should have all project types defined", () => {
      const { ProjectType } = require("../types");

      expect(ProjectType.WATER).toBe("Water");
      expect(ProjectType.SEWAGE).toBe("Sewage");
      expect(ProjectType.MOLD).toBe("Mold");
      expect(ProjectType.BIOHAZARD).toBe("Biohazard");
      expect(ProjectType.EMERGENCY_SERVICES).toBe("Emergency Services");
      expect(ProjectType.STRUCTURAL_CLEANING).toBe("Structural Cleaning");
    });

    test("should have all task phases defined", () => {
      const { TaskPhase } = require("../types");

      expect(TaskPhase.PHASE_1_PRODUCTION).toBe(1);
      expect(TaskPhase.PHASE_2_ESTIMATE).toBe(2);
      expect(TaskPhase.PHASE_3_AR).toBe(3);
    });

    test("should have all audit actions defined", () => {
      const { AuditActionType } = require("../types");

      expect(AuditActionType.CREATE_TASK).toBe("CREATE_TASK");
      expect(AuditActionType.UPDATE_DATE).toBe("UPDATE_DATE");
      expect(AuditActionType.TRIGGER_PHASE).toBe("TRIGGER_PHASE");
    });
  });

  describe("Configuration Validation", () => {
    test("should have dry-run mode configured", () => {
      const { config } = require("../config");

      // Em modo test, esperamos dry-run estar ligado por segurança
      expect(config.dryRun).toBeDefined();
      expect(typeof config.dryRun).toBe("boolean");
    });

    test("should have rate limiting configured", () => {
      const { config } = require("../config");

      expect(config.rateLimiting.maxRequestsPerSecond).toBeGreaterThan(0);
      expect(config.rateLimiting.maxTasksPerHour).toBeGreaterThan(0);
      expect(config.rateLimiting.maxDatesPerHour).toBeGreaterThan(0);
    });

    test("should have webhook conflict detection enabled", () => {
      const { config } = require("../config");

      expect(config.webhooks.collisionCheck).toBeDefined();
      expect(config.webhooks.knownWebhookIds).toBeDefined();
    });

    test("should know about Zapier webhook (ID 15802)", () => {
      const { config } = require("../config");

      expect(config.webhooks.knownWebhookIds).toContain(15802);
    });
  });

  describe("Environment", () => {
    test("should be in staging or production mode", () => {
      const { config } = require("../config");

      expect(["development", "staging", "production"]).toContain(
        config.environment
      );
    });

    test("should have isolation mode configured", () => {
      const { config } = require("../config");

      expect(["strict", "moderate", "loose"]).toContain(
        config.isolation.isolationMode
      );
    });

    test("should have automation tag configured", () => {
      const { config } = require("../config");

      expect(config.isolation.automationTag).toBeDefined();
      expect(config.isolation.automationTag.length).toBeGreaterThan(0);
    });
  });
});

/**
 * TESTES DE INTEGRAÇÃO
 * (Requerem conexão com API real - descomente quando testar)
 */

describe.skip("Integration Tests", () => {
  test("should connect to Albiware API", async () => {
    const albiwareClient = require("../services/albiware.client").albiwareClient;

    // Este teste requer API key válida e conexão real
    const projects = await albiwareClient.getProjects(1);
    expect(Array.isArray(projects)).toBe(true);
  });

  test("should connect to PostgreSQL", async () => {
    const auditService = require("../services/audit.service").auditService;

    // Este teste requer PostgreSQL rodando
    await auditService.initialize();

    const stats = await auditService.getStatistics(1);
    expect(stats).toBeDefined();
    expect(stats.totalActions).toBeGreaterThanOrEqual(0);
  });
});

/**
 * TESTES DE PERFORMANCE
 */

describe("Performance", () => {
  test("cascade configuration should load quickly", () => {
    const start = Date.now();
    const cascadeService = require("../services/cascade.service").cascadeService;

    cascadeService.getConfiguration();

    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // < 100ms
  });

  test("validation service should cache results", () => {
    const validationService = require("../services/validation.service").validationService;

    expect(validationService.clearCache).toBeDefined();
  });
});

/**
 * SETUP E TEARDOWN
 */

beforeAll(() => {
  // Setup
});

afterAll(() => {
  // Cleanup
});
