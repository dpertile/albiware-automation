import dotenv from "dotenv";
import Joi from "joi";
import { Config, ProjectType } from "../types/index.js";

dotenv.config();

/**
 * SCHEMA DE VALIDAÇÃO DE CONFIGURAÇÃO
 * Garante que todas variáveis de ambiente estão presentes e corretas
 */

const configSchema = Joi.object({
  // Ambiente
  NODE_ENV: Joi.string()
    .valid("development", "staging", "production")
    .default("development"),
  DRY_RUN: Joi.boolean().default(false),
  VALIDATE_ALL_ACTIONS: Joi.boolean().default(true),
  LOG_ALL_REQUESTS: Joi.boolean().default(true),
  ENABLE_ROLLBACK: Joi.boolean().default(true),
  ENABLE_ALERTS: Joi.boolean().default(true),

  // API Albiware
  ALBIWARE_API_KEY: Joi.string().required(),
  ALBIWARE_API_BASE_URL: Joi.string()
    .uri()
    .default("https://api.albiware.com/v5/Integrations"),
  API_TIMEOUT_MS: Joi.number().default(30000),
  API_MAX_RETRIES: Joi.number().default(3),
  API_RETRY_BACKOFF_MS: Joi.number().default(1000),

  // Database
  DB_HOST: Joi.string().default("localhost"),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().default("automation"),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().default("albiware_automation"),
  DB_SSL: Joi.boolean().default(false),

  // Rate Limiting
  MAX_REQUESTS_PER_SECOND: Joi.number().default(10),
  MAX_TASKS_PER_HOUR: Joi.number().default(100),
  MAX_DATES_PER_HOUR: Joi.number().default(50),

  // Monitoring
  ENABLE_AUDIT_LOG: Joi.boolean().default(true),
  ALERT_ON_ERROR: Joi.boolean().default(true),
  ALERT_CHANNEL: Joi.string().valid("slack", "email", "both").default("slack"),
  SLACK_WEBHOOK_URL: Joi.string().uri(),
  EMAIL_RECIPIENTS: Joi.string().default(""),

  // Isolation & Safety
  AUTOMATION_TAG: Joi.string().default("automated-cascade-v1"),
  AUTOMATION_OWNER: Joi.string().default("system-automation"),
  ISOLATION_MODE: Joi.string()
    .valid("strict", "moderate", "loose")
    .default("strict"),

  // Webhooks
  KNOWN_WEBHOOK_IDS: Joi.string()
    .default("15802")
    .external(async (value) => {
      // Validar que são IDs válidos
      const ids = value.split(",").map((id) => parseInt(id.trim(), 10));
      if (ids.some(isNaN)) {
        throw new Error("KNOWN_WEBHOOK_IDS deve conter apenas números");
      }
    }),
  WEBHOOK_COLLISION_CHECK: Joi.boolean().default(true),
  WEBHOOK_CONFLICT_ACTION: Joi.string()
    .valid("pause_automation", "log_only", "continue")
    .default("pause_automation"),

  // Cascade Configuration
  PROJECT_TYPES: Joi.string()
    .default(
      "Biohazard,Emergency Services,Mold,Sewage,Structural Cleaning,Water"
    ),

  // Server
  SERVER_PORT: Joi.number().default(3000),
  SERVER_HOST: Joi.string().default("0.0.0.0"),
});

/**
 * VALIDAR E CARREGAR CONFIGURAÇÃO
 */

const { error, value: envVars } = configSchema.prefs({ errors: { label: "key" } }).validate(
  process.env,
  {
    abortEarly: false,
  }
);

if (error) {
  console.error("❌ ERRO DE CONFIGURAÇÃO:");
  console.error(error.details.map((x) => `  - ${x.message}`).join("\n"));
  process.exit(1);
}

/**
 * CONSTRUIR OBJETO DE CONFIGURAÇÃO TIPADO
 */

export const config: Config = {
  environment: envVars.NODE_ENV as "development" | "staging" | "production",
  dryRun: envVars.DRY_RUN === true || envVars.DRY_RUN === "true",
  validateAllActions: envVars.VALIDATE_ALL_ACTIONS === true || envVars.VALIDATE_ALL_ACTIONS === "true",
  logAllRequests: envVars.LOG_ALL_REQUESTS === true || envVars.LOG_ALL_REQUESTS === "true",
  enableRollback: envVars.ENABLE_ROLLBACK === true || envVars.ENABLE_ROLLBACK === "true",
  enableAlerts: envVars.ENABLE_ALERTS === true || envVars.ENABLE_ALERTS === "true",

  api: {
    key: envVars.ALBIWARE_API_KEY,
    baseUrl: envVars.ALBIWARE_API_BASE_URL,
    timeout: envVars.API_TIMEOUT_MS,
    maxRetries: envVars.API_MAX_RETRIES,
    retryBackoffMs: envVars.API_RETRY_BACKOFF_MS,
  },

  database: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    username: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    database: envVars.DB_NAME,
    ssl: envVars.DB_SSL,
  },

  rateLimiting: {
    maxRequestsPerSecond: envVars.MAX_REQUESTS_PER_SECOND,
    maxTasksPerHour: envVars.MAX_TASKS_PER_HOUR,
    maxDatesPerHour: envVars.MAX_DATES_PER_HOUR,
  },

  monitoring: {
    enableAuditLog: envVars.ENABLE_AUDIT_LOG,
    enableAlerts: envVars.ENABLE_ALERTS,
    alertOnError: envVars.ALERT_ON_ERROR,
    alertChannels: envVars.ALERT_CHANNEL.includes("slack")
      ? ["slack", "email"]
      : [
          (envVars.ALERT_CHANNEL as "slack" | "email"),
        ],
    slackWebhookUrl: envVars.SLACK_WEBHOOK_URL,
    emailRecipients: envVars.EMAIL_RECIPIENTS
      ? envVars.EMAIL_RECIPIENTS.split(",").map((e: string) => e.trim())
      : undefined,
  },

  isolation: {
    automationTag: envVars.AUTOMATION_TAG,
    automationOwner: envVars.AUTOMATION_OWNER,
    isolationMode: envVars.ISOLATION_MODE,
  },

  webhooks: {
    knownWebhookIds: envVars.KNOWN_WEBHOOK_IDS.split(",").map((id: string) =>
      parseInt(id.trim(), 10)
    ),
    collisionCheck: envVars.WEBHOOK_COLLISION_CHECK,
    conflictAction: envVars.WEBHOOK_CONFLICT_ACTION,
  },

  cascade: {
    projectTypes: envVars.PROJECT_TYPES.split(",").map((type: string) => type.trim()) as ProjectType[],
    defaultAssignments: {
      phase1Lead: "Lead Project Manager",
      phase2Lead: "Lead Estimator",
      phase3Lead: "Lead A/R",
    },
  },
};

/**
 * LOG DA CONFIGURAÇÃO (sem expor dados sensíveis)
 */

export function logConfigSummary() {
  console.log("\n📋 CONFIGURAÇÃO CARREGADA:");
  console.log(`  Environment: ${config.environment}`);
  console.log(`  Dry Run: ${config.dryRun ? "✅ ATIVO" : "❌ DESATIVO"}`);
  console.log(`  Validações: ${config.validateAllActions ? "✅ ATIVAS" : "❌ INATIVAS"}`);
  console.log(`  Audit Log: ${config.monitoring.enableAuditLog ? "✅ ATIVO" : "❌ INATIVO"}`);
  console.log(`  Rate Limit: ${config.rateLimiting.maxRequestsPerSecond} req/s`);
  console.log(`  Project Types: ${config.cascade.projectTypes.join(", ")}`);
  console.log(`  API Key: ${config.api.key.substring(0, 8)}...`);
  console.log(`  Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
  console.log(`  Isolation Mode: ${config.isolation.isolationMode.toUpperCase()}`);
  console.log(`  Webhook Conflict Check: ${config.webhooks.collisionCheck ? "✅" : "❌"}`);
  console.log(`  Known Webhooks: [${config.webhooks.knownWebhookIds.join(", ")}]`);
  console.log();
}

export default config;
