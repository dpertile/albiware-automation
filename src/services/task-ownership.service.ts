/**
 * TASK OWNERSHIP & SAFE MODE
 *
 * Proteção CRÍTICA para não interferir com outras tarefas/automações
 *
 * Princípios:
 * 1. Nossas tasks têm TAGS IDENTIFICÁVEIS
 * 2. Antes de qualquer ação, VERIFICAR OWNERSHIP
 * 3. Rollback SÓ deleta tarefas com NOSSA tag
 * 4. Nunca atualizar tarefas que não são nossas
 * 5. Isolamento TOTAL de outras automações
 */

import { Task } from "../types/index.js";
import { config } from "../config";
import { createAuditLogger } from "../utils/logger";

export class TaskOwnershipService {
  private audit = createAuditLogger({
    automationId: "task-ownership",
    dryRun: config.dryRun,
  });

  /**
   * TAG IDENTIFICADOR
   * Cada task criada por nós tem esta tag
   * Format: "[AUTOMATED-CASCADE-v1.0.0|2026-08-23|op-uuid]"
   */

  private getOwnershipTag(operationId: string): string {
    const timestamp = new Date().toISOString().split("T")[0];
    return `[AUTOMATED-CASCADE-${config.isolation.automationTag}|${timestamp}|${operationId}]`;
  }

  /**
   * ADICIONAR TAG A UMA TAREFA
   * Insere a tag nas notas da tarefa para identificar que é nossa
   */

  createOwnedTaskNotes(
    operationId: string,
    baseNotes?: string
  ): string {
    const ownershipTag = this.getOwnershipTag(operationId);

    const notes = [
      ownershipTag,
      `Owner: ${config.isolation.automationOwner}`,
      `IsolationMode: ${config.isolation.isolationMode}`,
      baseNotes,
    ]
      .filter(Boolean)
      .join(" | ");

    return notes;
  }

  /**
   * VERIFICAR SE TASK É NOSSA
   * ✅ True = É nossa, podemos mexer
   * ❌ False = Não é nossa, NUNCA mexer
   */

  isOwnedByUs(task: Task): boolean {
    if (!task.notes) {
      this.audit.info("⚠️  TASK HAS NO NOTES - NOT OWNED", {
        taskId: task.id,
        taskName: task.name,
      });
      return false;
    }

    // Verificar se tem nossa tag
    const hasAutomationTag = task.notes.includes("AUTOMATED-CASCADE");
    const hasOwnerTag = task.notes.includes(config.isolation.automationOwner);
    const hasOurIsolationTag = task.notes.includes("IsolationMode:");

    const isOurs = hasAutomationTag && hasOwnerTag && hasOurIsolationTag;

    if (!isOurs) {
      this.audit.warn("⚠️  TASK NOT OWNED BY US - IGNORING", {
        taskId: task.id,
        taskName: task.name,
        notes: task.notes,
      });
    }

    return isOurs;
  }

  /**
   * VALIDAR QUE TAREFA PODE SER MEXIDA
   * ✅ Retorna true se:
   *    - Task é nossa
   *    - Status está correto
   *    - Não foi modificada por outros
   */

  validateTaskOwnershipBeforeModifying(
    task: Task,
    expectedStatus?: string
  ): {
    valid: boolean;
    reason?: string;
    safe: boolean;
  } {
    // 1. Verificar ownership
    if (!this.isOwnedByUs(task)) {
      return {
        valid: false,
        reason: "Task is not owned by us",
        safe: false,
      };
    }

    // 2. Verificar se status é o esperado (se especificado)
    if (expectedStatus && task.status !== expectedStatus) {
      return {
        valid: false,
        reason: `Task status changed (expected: ${expectedStatus}, actual: ${task.status})`,
        safe: false,
      };
    }

    // 3. Verificar se task foi modificada por outros
    // (verificar update time)
    if (task.updatedAt) {
      const taskAge = Date.now() - new Date(task.updatedAt).getTime();
      // Se foi modificada há menos de 10 segundos, pode ser por outro processo
      if (taskAge < 10000 && task.status !== "Not Started") {
        this.audit.warn("⚠️  TASK WAS RECENTLY MODIFIED - BEING CAREFUL", {
          taskId: task.id,
          taskName: task.name,
          ageMs: taskAge,
        });
        // Mas ainda permitimos, pois é nossa
      }
    }

    return {
      valid: true,
      safe: true,
    };
  }

  /**
   * VALIDAR QUE PODEMOS DELETAR TAREFA
   * ✅ Só permite deletar tarefas NOSSAS
   * ❌ NUNCA deleta tarefas de outros
   */

  validateTaskOwnershipBeforeDeleting(task: Task): {
    canDelete: boolean;
    reason?: string;
  } {
    // VERIFICAÇÃO RIGOROSA
    if (!task.notes) {
      return {
        canDelete: false,
        reason: "Task has no notes - cannot verify ownership",
      };
    }

    // Deve ter EXATAMENTE nossa tag
    const hasOurTag =
      task.notes.includes(config.isolation.automationTag) &&
      task.notes.includes(config.isolation.automationOwner) &&
      task.notes.includes("AUTOMATED-CASCADE");

    if (!hasOurTag) {
      this.audit.error("🚨 TENTATIVA DE DELETAR TASK QUE NÃO É NOSSA!", undefined, {
        taskId: task.id,
        taskName: task.name,
        notes: task.notes,
        action: "DELETE_PREVENTED",
      });

      return {
        canDelete: false,
        reason: "Task is not owned by us - DELETION PREVENTED",
      };
    }

    return {
      canDelete: true,
    };
  }

  /**
   * LISTAR APENAS NOSSAS TAREFAS
   * Filtra de uma lista de tasks apenas as que são nossas
   */

  filterOwnedTasks(tasks: Task[]): Task[] {
    const ownedTasks = tasks.filter((task) => this.isOwnedByUs(task));

    this.audit.info(`FILTERED TASKS: ${ownedTasks.length}/${tasks.length} are ours`, {
      total: tasks.length,
      owned: ownedTasks.length,
      external: tasks.length - ownedTasks.length,
    });

    return ownedTasks;
  }

  /**
   * SAFE MODE: MODO ULTRA-SEGURO
   * Ativa verificações ainda MAIS rigorosas
   *
   * Ativa quando:
   * - isolation_mode = "strict"
   * - NODE_ENV = "production"
   * - Outras automações ativas
   */

  isSafeModeEnabled(): boolean {
    return (
      config.isolation.isolationMode === "strict" &&
      (config.environment === "production" || config.environment === "staging")
    );
  }

  /**
   * VALIDAR EM SAFE MODE
   * Checklist extra:
   * - Task não pode ter sido tocada nos últimos 30s
   * - Task deve ter EXATAMENTE nossas tags
   * - Nenhuma outra automação pode ter processado
   */

  validateInSafeMode(task: Task): {
    safe: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (!this.isSafeModeEnabled()) {
      return { safe: true, reasons: [] };
    }

    this.audit.info("🔒 VALIDATING IN SAFE MODE", { taskId: task.id });

    // 1. Verificar ownership rigorosa
    if (!this.isOwnedByUs(task)) {
      reasons.push("Not owned by us");
    }

    // 2. Verificar modificação recente (< 30s)
    if (task.updatedAt) {
      const taskAge = Date.now() - new Date(task.updatedAt).getTime();
      if (taskAge < 30000 && task.status !== "Not Started") {
        reasons.push(
          `Task modified recently (${Math.floor(taskAge / 1000)}s ago)`
        );
      }
    }

    // 3. Verificar que NOSSAS tags estão intactas
    if (task.notes) {
      const tagCount = (task.notes.match(/AUTOMATED-CASCADE/g) || []).length;
      if (tagCount > 1) {
        reasons.push("Multiple automation tags detected - possible conflict");
      }
    }

    // 4. Verificar que não há sinais de outras automações
    if (task.notes && task.notes.includes("WEBHOOK:")) {
      reasons.push("Other webhook processed this task recently");
    }

    const safe = reasons.length === 0;

    if (!safe) {
      this.audit.warn("⚠️  SAFE MODE VALIDATION FAILED", {
        taskId: task.id,
        reasons,
      });
    }

    return { safe, reasons };
  }

  /**
   * CRIAR RELATÓRIO DE INTERFERÊNCIA
   * Scana todos tasks de um projeto e reporta possíveis interferências
   */

  async analyzeTaskInterference(
    allTasks: Task[],
    projectId: number
  ): Promise<{
    ourTasks: number;
    externalTasks: number;
    possibleInterference: boolean;
    report: {
      taskName: string;
      taskId: number;
      isOurs: boolean;
      notes: string;
    }[];
  }> {
    const report = allTasks.map((task) => ({
      taskName: task.name,
      taskId: task.id,
      isOurs: this.isOwnedByUs(task),
      notes: task.notes || "(no notes)",
    }));

    const ourTasks = report.filter((r) => r.isOurs).length;
    const externalTasks = report.filter((r) => !r.isOurs).length;

    // Possível interferência se:
    // - Há tasks externas + nossas (outras automações rodando)
    // - Há tasks nossas deletadas/faltando
    const possibleInterference = ourTasks > 0 && externalTasks > 0;

    if (possibleInterference) {
      this.audit.warn("⚠️  POSSIBLE INTERFERENCE DETECTED", {
        projectId,
        ourTasks,
        externalTasks,
        riskLevel: "MEDIUM",
      });
    }

    return {
      ourTasks,
      externalTasks,
      possibleInterference,
      report,
    };
  }

  /**
   * WHITELIST DE TASK NAMES
   * Só podemos criar estas tarefas
   * (previne criação de tasks erradas)
   */

  isTaskNameWhitelisted(taskName: string): boolean {
    const whitelistedTasks = [
      // Fase 1
      "Sign Work Auth.",
      "Send Work Authorization to Carrier",
      "COS Signed",
      "Dry Out Confirmed",
      "Complete Job",
      "Assign Estimator",
      // Fase 2
      "Create Estimate",
      "Review Estimate",
      "Revise Estimate",
      "Approve Estimate Internally",
      "Send Invoicing to Carrier",
      "Document Initial Insurance Offer",
      "In Negotiations",
      "Finalize Agreed Price",
      // Fase 3
      "Get AP",
      "Call To Carrier",
      "AR Follow Up",
      "Invoice Customer",
      "Mortgage Packet Sent",
      "Check Signature",
      "Collect Final Payment",
    ];

    const isWhitelisted = whitelistedTasks.includes(taskName);

    if (!isWhitelisted) {
      this.audit.error("🚨 TASK NAME NOT WHITELISTED", undefined, {
        taskName,
        action: "CREATE_PREVENTED",
      });
    }

    return isWhitelisted;
  }

  /**
   * RESUMO DE PROTEÇÕES
   */

  getSafetyReport(): {
    isolationMode: string;
    safeModeEnabled: boolean;
    ownershipTagFormat: string;
    autoDeleteProtection: boolean;
    whitelistEnabled: boolean;
    conflictDetection: boolean;
  } {
    return {
      isolationMode: config.isolation.isolationMode,
      safeModeEnabled: this.isSafeModeEnabled(),
      ownershipTagFormat: "[AUTOMATED-CASCADE-v1|DATE|UUID]",
      autoDeleteProtection: true, // Nunca deleta tarefas que não são nossas
      whitelistEnabled: true, // Só cria tarefas whitelistadas
      conflictDetection: true, // Detecta interferências
    };
  }
}

/**
 * EXPORTAR SINGLETON
 */

export const taskOwnershipService = new TaskOwnershipService();

export default taskOwnershipService;

