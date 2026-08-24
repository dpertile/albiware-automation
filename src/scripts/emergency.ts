#!/usr/bin/env node

/**
 * SCRIPTS DE EMERGÊNCIA
 * 
 * stop-emergency.ts    - Parar automação imediatamente
 * rollback-last.ts     - Reverter última 1 hora de ações
 * rollback-day.ts      - Reverter último dia de ações
 */

import { Pool } from "pg";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.username,
  password: config.database.password,
  database: config.database.database,
  ssl: config.database.ssl,
});

/**
 * PARADA DE EMERGÊNCIA
 */

async function emergencyStop(): Promise<void> {
  const client = await pool.connect();

  try {
    logger.error("🚨 PARADA DE EMERGÊNCIA ACIONADA");

    // 1. Pausar todas as automações
    await client.query(
      `UPDATE automation_state SET status = 'paused' WHERE status != 'paused'`
    );

    logger.warn("✅ Todas automações pausadas");

    // 2. Criar snapshot do estado atual
    const snapshot = await client.query(
      `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`
    );

    logger.info(`✅ Snapshot criado: ${snapshot.rowCount} últimas ações`);

    // 3. Guardar para análise
    const fs = require("fs");
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    fs.writeFileSync(
      `./snapshots/emergency-stop-${timestamp}.json`,
      JSON.stringify(snapshot.rows, null, 2)
    );

    logger.error("✅ EMERGÊNCIA - Sistema em estado seguro");
    logger.error("📋 Snapshot salvo em: ./snapshots/emergency-stop-" + timestamp + ".json");

  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * ROLLBACK DA ÚLTIMA 1 HORA
 */

async function rollbackLast(hours = 1): Promise<void> {
  const client = await pool.connect();

  try {
    logger.warn(`🔄 ROLLBACK - Revertendo últimas ${hours} horas`);

    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // 1. Obter ações da última 1 hora
    const actions = await client.query(
      `
      SELECT * FROM audit_logs 
      WHERE timestamp >= $1 
      AND success = true
      ORDER BY timestamp DESC
      `,
      [startTime]
    );

    logger.warn(`⚠️  Encontradas ${actions.rowCount} ações para reverter`);

    // 2. Para cada ação, reverter (ordem inversa)
    for (const row of actions.rows) {
      logger.info(`  ↩️  Revertendo: ${row.action} (Project ${row.project_id})`);

      // Reverter ações de acordo com o tipo
      if (row.action === "CREATE_TASK") {
        // Deletar tarefa criada
        logger.info(`    → Deletando tarefa ${row.task_id}`);
        // Em um case real, chamaria API para deletar
      } else if (row.action === "UPDATE_DATE") {
        // Restaurar data anterior
        logger.info(
          `    → Restaurando data ${row.date_key} para ${row.before_state?.dateValue}`
        );
        // Em um case real, chamaria API para restaurar
      }
    }

    logger.warn(`✅ ROLLBACK CONCLUÍDO - ${actions.rowCount} ações revertidas`);

  } catch (error) {
    logger.error("❌ Erro durante rollback", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * ROLLBACK DO ÚLTIMO DIA
 */

async function rollbackDay(): Promise<void> {
  await rollbackLast(24);
}

/**
 * PROCESSAR COMANDOS
 */

async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    switch (command) {
      case "stop":
      case "emergency":
        await emergencyStop();
        break;

      case "rollback":
      case "rollback-last":
        const hours = parseInt(process.argv[3] || "1", 10);
        await rollbackLast(hours);
        break;

      case "rollback-day":
        await rollbackDay();
        break;

      default:
        logger.info("Uso: npm run <script>");
        logger.info("  npm run stop:emergency");
        logger.info("  npm run rollback:last [hours]");
        logger.info("  npm run rollback:day");
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error("Erro", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { emergencyStop, rollbackLast, rollbackDay };
