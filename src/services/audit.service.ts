import { Pool, PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/index.js";
import { createAuditLogger } from "../utils/logger.js";
import {
  AuditLogEntry,
  ConflictLog,
  AuditActionType,
  AutomationEventType,
} from "../types";
/**
 * SERVIÇO DE AUDITORIA
 *
 * Responsável por:
 * - Registrar cada ação da automação
 * - Detectar conflitos com webhooks
 * - Fornecer capacidade de rollback
 * - Fornecer queries para relatórios
 */
export class AuditService {
  private pool: Pool;
  private audit = createAuditLogger({
    automationId: "audit-service",
    dryRun: config.dryRun,
  });
  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.username,
      password: config.database.password,
      database: config.database.database,
      ssl: config.database.ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  /**
   * INICIALIZAR - CRIAR TABELAS SE NÃO EXISTEM
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      this.audit.info("Initializing audit database schema...");
      // Criar tabelas
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          automation_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) DEFAULT 'system',
          action VARCHAR(50) NOT NULL,
          project_id INTEGER,
          project_name VARCHAR(255),
          task_id INTEGER,
          task_name VARCHAR(255),
          date_key VARCHAR(255),
          before_state JSONB,
          after_state JSONB,
          success BOOLEAN DEFAULT false,
          error TEXT,
          dry_run BOOLEAN DEFAULT false,
          webhooks_triggered INTEGER[] DEFAULT ARRAY[]::INTEGER[],
          source_webhook VARCHAR(255),
          duration_ms INTEGER,
          metadata JSONB,
          -- Indexes para performance
          CONSTRAINT project_id_idx INDEX USING BTREE (project_id),
          CONSTRAINT timestamp_idx INDEX USING BTREE (timestamp DESC),
          CONSTRAINT action_idx INDEX USING BTREE (action)
        );
        CREATE TABLE IF NOT EXISTS conflict_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          project_id INTEGER NOT NULL,
          automation_action VARCHAR(50) NOT NULL,
          expected_webhook INTEGER,
          actual_webhooks_fired INTEGER[] DEFAULT ARRAY[]::INTEGER[],
          conflict_type VARCHAR(50) NOT NULL,
          description TEXT,
          resolved BOOLEAN DEFAULT false,
          resolution TEXT,
          metadata JSONB,
          CONSTRAINT project_id_conflict_idx INDEX USING BTREE (project_id),
          CONSTRAINT timestamp_conflict_idx INDEX USING BTREE (timestamp DESC)
        );
        CREATE TABLE IF NOT EXISTS automation_state (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id INTEGER UNIQUE NOT NULL,
          current_phase INTEGER,
          last_triggered_at TIMESTAMP WITH TIME ZONE,
          completed_tasks TEXT[] DEFAULT ARRAY[]::TEXT[],
          failed_tasks JSONB DEFAULT '[]'::JSONB,
          status VARCHAR(20) DEFAULT 'idle',
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS rollback_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          project_id INTEGER,
          phase INTEGER,
          tasks_created JSONB,
          dates_updated JSONB,
          automation_id VARCHAR(255),
          can_rollback BOOLEAN DEFAULT true
        );
      `);
      this.audit.info("✅ Database schema initialized");
    } catch (error) {
      this.audit.error(
        "Failed to initialize audit database",
        error as Error
      );
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * REGISTRAR AÇÃO NO AUDIT LOG
   */
  async logAction(entry: Omit<AuditLogEntry, "id">): Promise<string> {
    const client = await this.pool.connect();
    const id = uuidv4();
    try {
      await client.query(
        `
        INSERT INTO audit_logs (
          id, timestamp, automation_id, user_id, action,
          project_id, project_name, task_id, task_name, date_key,
          before_state, after_state, success, error, dry_run,
          webhooks_triggered, source_webhook, duration_ms, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        `,
        [
          id,
          entry.timestamp,
          entry.automationId,
          entry.userId || "system",
          entry.action,
          entry.projectId,
          entry.projectName,
          entry.taskId,
          entry.taskName,
          entry.dateKey,
          JSON.stringify(entry.before),
          JSON.stringify(entry.after),
          entry.success,
          entry.error,
          entry.dryRun,
          entry.webhooksTriggered || [],
          entry.sourceWebhook,
          entry.duration,
          JSON.stringify(entry.metadata),
        ]
      );
      return id;
    } finally {
      client.release();
    }
  }
  /**
   * REGISTRAR CONFLITO
   */
  async logConflict(conflict: Omit<ConflictLog, "id">): Promise<string> {
    const client = await this.pool.connect();
    const id = uuidv4();
    try {
      await client.query(
        `
        INSERT INTO conflict_logs (
          id, timestamp, project_id, automation_action,
          expected_webhook, actual_webhooks_fired, conflict_type,
          description, resolved, resolution, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          id,
          conflict.timestamp,
          conflict.projectId,
          conflict.automationAction,
          conflict.expectedWebhook,
          conflict.actualWebhooksFired || [],
          conflict.conflictType,
          conflict.description,
          conflict.resolved,
          conflict.resolution,
          JSON.stringify(conflict.metadata),
        ]
      );
      return id;
    } finally {
      client.release();
    }
  }
  /**
   * OBTER LOGS DE AUDITORIA COM FILTROS
   */
  async getLogs(
    filters?: {
      projectId?: number;
      action?: AuditActionType;
      startDate?: Date;
      endDate?: Date;
      onlyErrors?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLogEntry[]> {
    const client = await this.pool.connect();
    try {
      let query =
        "SELECT * FROM audit_logs WHERE 1=1";
      const params: any[] = [];
      let paramIndex = 1;
      if (filters?.projectId) {
        query += ` AND project_id = $${paramIndex++}`;
        params.push(filters.projectId);
      }
      if (filters?.action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(filters.action);
      }
      if (filters?.startDate) {
        query += ` AND timestamp >= $${paramIndex++}`;
        params.push(filters.startDate);
      }
      if (filters?.endDate) {
        query += ` AND timestamp <= $${paramIndex++}`;
        params.push(filters.endDate);
      }
      if (filters?.onlyErrors) {
        query += ` AND success = false`;
      }
      query += ` ORDER BY timestamp DESC`;
      if (filters?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }
      if (filters?.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(filters.offset);
      }
      const result = await client.query(query, params);
      return result.rows.map((row) => ({
        id: row.id,
        timestamp: new Date(row.timestamp),
        automationId: row.automation_id,
        userId: row.user_id,
        action: row.action,
        projectId: row.project_id,
        projectName: row.project_name,
        taskId: row.task_id,
        taskName: row.task_name,
        dateKey: row.date_key,
        before: row.before_state,
        after: row.after_state,
        success: row.success,
        error: row.error,
        dryRun: row.dry_run,
        webhooksTriggered: row.webhooks_triggered,
        sourceWebhook: row.source_webhook,
        duration: row.duration_ms,
        metadata: row.metadata,
      }));
    } finally {
      client.release();
    }
  }
  /**
   * OBTER CONFLITOS
   */
  async getConflicts(
    projectId?: number,
    resolved?: boolean
  ): Promise<ConflictLog[]> {
    const client = await this.pool.connect();
    try {
      let query = "SELECT * FROM conflict_logs WHERE 1=1";
      const params: any[] = [];
      if (projectId) {
        query += " AND project_id = $1";
        params.push(projectId);
      }
      if (resolved !== undefined) {
        query += ` AND resolved = $${params.length + 1}`;
        params.push(resolved);
      }
      query += " ORDER BY timestamp DESC";
      const result = await client.query(query, params);
      return result.rows.map((row) => ({
        id: row.id,
        timestamp: new Date(row.timestamp),
        projectId: row.project_id,
        automationAction: row.automation_action,
        expectedWebhook: row.expected_webhook,
        actualWebhooksFired: row.actual_webhooks_fired,
        conflictType: row.conflict_type,
        description: row.description,
        resolved: row.resolved,
        resolution: row.resolution,
      }));
    } finally {
      client.release();
    }
  }
  /**
   * SALVAR SNAPSHOT PARA ROLLBACK
   */
  async saveRollbackSnapshot(
    projectId: number,
    phase: number,
    tasksCreated: any,
    datesUpdated: any,
    automationId: string
  ): Promise<string> {
    const client = await this.pool.connect();
    const id = uuidv4();
    try {
      await client.query(
        `
        INSERT INTO rollback_snapshots (
          id, project_id, phase, tasks_created, dates_updated, automation_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          id,
          projectId,
          phase,
          JSON.stringify(tasksCreated),
          JSON.stringify(datesUpdated),
          automationId,
        ]
      );
      return id;
    } finally {
      client.release();
    }
  }
  /**
   * OBTER ESTATÍSTICAS
   */
  async getStatistics(hours = 24): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    tasksCreated: number;
    datesUpdated: number;
    conflicts: number;
    errorRate: number;
  }> {
    const client = await this.pool.connect();
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const result = await client.query(
        `
        SELECT
          COUNT(*) as total_actions,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_actions,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_actions,
          SUM(CASE WHEN action = 'CREATE_TASK' THEN 1 ELSE 0 END) as tasks_created,
          SUM(CASE WHEN action = 'UPDATE_DATE' THEN 1 ELSE 0 END) as dates_updated
        FROM audit_logs
        WHERE timestamp >= $1
        `,
        [startTime]
      );
      const row = result.rows[0];
      const total = parseInt(row.total_actions) || 0;
      const successful = parseInt(row.successful_actions) || 0;
      const failed = parseInt(row.failed_actions) || 0;
      // Conflitos
      const conflictResult = await client.query(
        `
        SELECT COUNT(*) as conflict_count
        FROM conflict_logs
        WHERE timestamp >= $1
        `,
        [startTime]
      );
      const conflicts = parseInt(conflictResult.rows[0].conflict_count) || 0;
      return {
        totalActions: total,
        successfulActions: successful,
        failedActions: failed,
        tasksCreated: parseInt(row.tasks_created) || 0,
        datesUpdated: parseInt(row.dates_updated) || 0,
        conflicts,
        errorRate: total > 0 ? (failed / total) * 100 : 0,
      };
    } finally {
      client.release();
    }
  }
  /**
   * LIMPAR CONEXÕES
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.audit.info("Audit service closed");
  }
}
/**
 * EXPORTAR INSTÂNCIA SINGLETON
 */
export const auditService = new AuditService();
export default auditService;
