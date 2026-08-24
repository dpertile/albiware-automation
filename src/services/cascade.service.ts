import { v4 as uuidv4 } from "uuid";
import { config } from "../config/index.js";
import { createAuditLogger, AuditLogger } from "../utils/logger.js";
import albiwareClient from "./albiware.client.js";
import validationService from "./validation.service.js";
import {
  Project,
  ProjectPhase,
  TaskPhase,
  TaskTemplate,
  CascadePhase,
  CascadeConfiguration,
  OperationResult,
<<<<<<< HEAD
} from "../types/index.js";

=======
} from "../types";
>>>>>>> 2f4c447443261ae7aa08944367329317a3b22e60
/**
 * MOTOR DE CASCATA - LÓGICA PRINCIPAL
 *
 * Implementa as 3 fases de automação:
 * 1. In Production (6 tarefas)
 * 2. Estimate Process (8 tarefas)
 * 3. Accounts Receivable (7 tarefas)
 *
 * Features:
 * - Criação automática de tasks
 * - Preenchimento de datas
 * - Gatilhos baseados em conclusão de tarefas
 * - Isolamento total
 * - Logging completo
 */
export class CascadeService {
  private audit: AuditLogger;
  private config: CascadeConfiguration;
  constructor() {
    this.audit = createAuditLogger({
      automationId: "cascade-service",
      dryRun: config.dryRun,
    });
    this.config = this.buildConfiguration();
  }
  /**
   * CONSTRUIR CONFIGURAÇÃO DE CASCATA
   */
  private buildConfiguration(): CascadeConfiguration {
    return {
      projectTypes: config.cascade.projectTypes,
      phases: [
        // ================================================================
        // FASE 1: "In Production"
        // ================================================================
        {
          phaseNumber: TaskPhase.PHASE_1_PRODUCTION,
          projectStatus: ProjectPhase.IN_PRODUCTION,
          tasks: [
            {
              name: "Sign Work Auth.",
              description: "Assinatura de Work Authorization",
              assignedToRole: "Technician",
              phase: TaskPhase.PHASE_1_PRODUCTION,
              dateKeyToUpdate: "Work Authorization Signed",
            },
            {
              name: "Send Work Authorization to Carrier",
              description: "Enviar Work Authorization à seguradora",
              assignedToRole: "Lead Project Manager",
              phase: TaskPhase.PHASE_1_PRODUCTION,
              dateKeyToUpdate: "Work Authorization Sent",
            },
            {
              name: "COS Signed",
              description: "Obter assinatura de Certificate of Service",
              assignedToRole: "Lead Project Manager",
              phase: TaskPhase.PHASE_1_PRODUCTION,
              dateKeyToUpdate: "Coc/Cos Signed",
            },
            {
              name: "Dry Out Confirmed",
              description: "Confirmar conclusão da secagem",
              assignedToRole: "Lead Project Manager",
              phase: TaskPhase.PHASE_1_PRODUCTION,
              dateKeyToUpdate: "Dry Out Confirmed",
            },
            {
              name: "Complete Job",
              description: "Completar trabalho no site",
              assignedToRole: "Lead Project Manager",
              phase: TaskPhase.PHASE_1_PRODUCTION,
              dateKeyToUpdate: "Work Complete",
            },
            {
              name: "Assign Estimator",
              description:
                "Designar estimador para criar orçamento (DISPARA FASE 2)",
              assignedToRole: "Lead Project Manager",
              phase: TaskPhase.PHASE_1_PRODUCTION,
              dateKeyToUpdate: "Estimator Assigned",
              precedingTask: undefined, // Última tarefa da fase 1
            },
          ],
          triggerTask: "Assign Estimator",
          triggerDateKey: "Estimator Assigned",
        },
        // ================================================================
        // FASE 2: "Estimate Process"
        // ================================================================
        {
          phaseNumber: TaskPhase.PHASE_2_ESTIMATE,
          projectStatus: ProjectPhase.ESTIMATE_PROCESS,
          tasks: [
            {
              name: "Create Estimate",
              description: "Criar orçamento inicial",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "Estimated Completion Date",
            },
            {
              name: "Review Estimate",
              description: "Revisar orçamento criado",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "Estimate Reviewed",
            },
            {
              name: "Revise Estimate",
              description: "Fazer revisões no orçamento",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "Final File Review",
            },
            {
              name: "Approve Estimate Internally",
              description: "Aprovação interna do orçamento",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "Estimate Approved",
            },
            {
              name: "Send Invoicing to Carrier",
              description: "Enviar faturamento à seguradora",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "Invoiced Carrier",
            },
            {
              name: "Document Initial Insurance Offer",
              description: "Documentar proposta inicial da seguradora",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "Insurance Offer",
            },
            {
              name: "In Negotiations",
              description: "Negociar com seguradora",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "Negotiations Started",
            },
            {
              name: "Finalize Agreed Price",
              description:
                "Finalizar preço acordado com seguradora (DISPARA FASE 3)",
              assignedToRole: "Lead Estimator",
              phase: TaskPhase.PHASE_2_ESTIMATE,
              dateKeyToUpdate: "AP Approved",
              precedingTask: undefined, // Última tarefa da fase 2
            },
          ],
          triggerTask: "Finalize Agreed Price",
          triggerDateKey: "AP Approved",
        },
        // ================================================================
        // FASE 3: "Accounts Receivable"
        // ================================================================
        {
          phaseNumber: TaskPhase.PHASE_3_AR,
          projectStatus: ProjectPhase.ACCOUNTS_RECEIVABLE,
          tasks: [
            {
              name: "Get AP",
              description: "Obter Accounts Payable da seguradora",
              assignedToRole: "Lead A/R",
              phase: TaskPhase.PHASE_3_AR,
              dateKeyToUpdate: "AP Received",
            },
            {
              name: "Call To Carrier",
              description: "Ligar para seguradora acompanhar pagamento",
              assignedToRole: "Lead A/R",
              phase: TaskPhase.PHASE_3_AR,
              dateKeyToUpdate: "First AR Follow Up Completed",
            },
            {
              name: "AR Follow Up",
              description: "Acompanhamento de Accounts Receivable",
              assignedToRole: "Lead A/R",
              phase: TaskPhase.PHASE_3_AR,
              dateKeyToUpdate: "AR Follow Up Completed",
            },
            {
              name: "Invoice Customer",
              description: "Faturar cliente",
              assignedToRole: "Lead A/R",
              phase: TaskPhase.PHASE_3_AR,
              dateKeyToUpdate: "Invoiced Customer",
            },
            {
              name: "Mortgage Packet Sent",
              description: "Enviar pacote de hipoteca se necessário",
              assignedToRole: "Lead A/R",
              phase: TaskPhase.PHASE_3_AR,
              dateKeyToUpdate: "Mortgage Packet Sent",
            },
            {
              name: "Check Signature",
              description: "Obter assinatura do cheque",
              assignedToRole: "Lead A/R",
              phase: TaskPhase.PHASE_3_AR,
              dateKeyToUpdate: "Check Signed",
            },
            {
              name: "Collect Final Payment",
              description: "Receber pagamento final (PROJETO CONCLUÍDO)",
              assignedToRole: "Accounting",
              phase: TaskPhase.PHASE_3_AR,
              dateKeyToUpdate: "Final Paid Date/Date Closed",
              precedingTask: undefined, // Última tarefa da fase 3
            },
          ],
          triggerTask: "Collect Final Payment",
          triggerDateKey: "Final Paid Date/Date Closed",
        },
      ],
      assignmentRules: {
        "Lead Project Manager": {
          defaultRole: "Lead Project Manager",
          canReassign: true,
        },
        "Lead Estimator": {
          defaultRole: "Lead Estimator",
          canReassign: true,
        },
        "Lead A/R": {
          defaultRole: "Lead A/R",
          canReassign: true,
        },
        Technician: {
          defaultRole: "Technician",
          canReassign: true,
        },
        Accounting: {
          defaultRole: "Accounting",
          canReassign: false,
        },
      },
    };
  }
  /**
   * DISPARAR CASCATA PARA NOVO PROJETO
   * Ponto de entrada principal
   */
  async triggerCascadeForProject(projectId: number): Promise<OperationResult> {
    const operationId = uuidv4();
    const startTime = Date.now();
    try {
      this.audit.info(
        `🚀 INICIANDO CASCATA PARA PROJETO`,
        {
          operationId,
          projectId,
          dryRun: config.dryRun,
        }
      );
      // 1. Validar projeto
      const project = await albiwareClient.getProject(projectId, {
        operationId,
        audit: this.audit,
      });
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      // 2. Verificar se projeto é tipo aplicável
      if (!config.cascade.projectTypes.includes(project.projectType as any)) {
        return {
          success: false,
          error: `Project type "${project.projectType}" not in automation scope`,
          dryRun: config.dryRun,
          timestamp: new Date(),
        };
      }
      // 3. Obter phase 1 config
      const phase1 = this.config.phases[0];
      // 4. Criar tasks da fase 1
      const phase1Result = await this.createPhase(
        projectId,
        project,
        phase1,
        operationId
      );
      if (!phase1Result.success) {
        return phase1Result;
      }
      const duration = Date.now() - startTime;
      this.audit.info(
        `✅ CASCATA INICIADA COM SUCESSO`,
        {
          operationId,
          projectId,
          duration,
          tasksCreated: (phase1Result.data as any)?.tasksCreated || 0,
        }
      );
      return {
        success: true,
        data: {
          projectId,
          projectName: project.name,
          operationId,
          phase1Result,
        },
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.audit.error(
        `❌ ERRO AO DISPARAR CASCATA`,
        error as Error,
        {
          operationId,
          projectId,
          duration,
        }
      );
      return {
        success: false,
        error: (error as Error).message,
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    }
  }
  /**
   * CRIAR UMA PHASE COMPLETA
   */
  private async createPhase(
    projectId: number,
    project: Project,
    phase: CascadePhase,
    operationId: string
  ): Promise<OperationResult> {
    const phaseStartTime = Date.now();
    const tasksCreated = [];
    const tasksSkipped = [];
    const errors = [];
    try {
      this.audit.info(
        `📋 CRIANDO FASE ${phase.phaseNumber} (${phase.projectStatus})`,
        {
          operationId,
          projectId,
          taskCount: phase.tasks.length,
        }
      );
      // Criar cada tarefa da fase
      for (const taskTemplate of phase.tasks) {
        try {
          const taskResult = await this.createTaskFromTemplate(
            projectId,
            project,
            taskTemplate,
            phase.phaseNumber,
            operationId
          );
          if (taskResult.success) {
            tasksCreated.push((taskResult.data as any)?.taskName);
          } else if (taskResult.data?.skipped) {
            tasksSkipped.push(taskTemplate.name);
          } else {
            errors.push({
              task: taskTemplate.name,
              error: taskResult.error,
            });
          }
        } catch (error) {
          errors.push({
            task: taskTemplate.name,
            error: (error as Error).message,
          });
        }
      }
      const phaseDuration = Date.now() - phaseStartTime;
      // Resultado da fase
      const phaseSuccess =
        tasksCreated.length > 0 && errors.length === 0;
      if (phaseSuccess) {
        this.audit.info(
          `✅ FASE ${phase.phaseNumber} CONCLUÍDA`,
          {
            operationId,
            projectId,
            phaseDuration,
            tasksCreated: tasksCreated.length,
            tasksSkipped: tasksSkipped.length,
          }
        );
      } else {
        this.audit.warn(
          `⚠️ FASE ${phase.phaseNumber} CONCLUÍDA COM ERROS`,
          {
            operationId,
            projectId,
            phaseDuration,
            tasksCreated: tasksCreated.length,
            tasksSkipped: tasksSkipped.length,
            errors: errors.length,
          }
        );
      }
      return {
        success: phaseSuccess,
        data: {
          phase: phase.phaseNumber,
          tasksCreated,
          tasksSkipped,
          errors: errors.length > 0 ? errors : undefined,
        },
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    } catch (error) {
      this.audit.error(
        `❌ ERRO AO CRIAR FASE ${phase.phaseNumber}`,
        error as Error,
        {
          operationId,
          projectId,
          tasksCreated: tasksCreated.length,
          errors: errors.length,
        }
      );
      return {
        success: false,
        error: (error as Error).message,
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    }
  }
  /**
   * CRIAR UMA TAREFA A PARTIR DE TEMPLATE
   */
  private async createTaskFromTemplate(
    projectId: number,
    project: Project,
    template: TaskTemplate,
    phase: TaskPhase,
    operationId: string
  ): Promise<OperationResult> {
    try {
      // 1. Validar criação de tarefa
      const validation = await validationService.validateTaskCreation(
        projectId,
        template.name,
        phase,
        this.config.phases[phase - 1].projectStatus,
        undefined
      );
      if (!validation.allChecks.valid) {
        // Se tarefa já existe, não é erro (idempotência)
        if (!validation.taskNotDuplicate) {
          this.audit.info(
            `⏭️  TAREFA JÁ EXISTE (PULANDO)`,
            {
              operationId,
              projectId,
              taskName: template.name,
            }
          );
          return {
            success: true,
            data: {
              skipped: true,
              taskName: template.name,
              reason: "Task already exists",
            },
            dryRun: config.dryRun,
            timestamp: new Date(),
          };
        }
        // Outros erros
        throw new Error(
          `Validation failed: ${validation.allChecks.errors.join("; ")}`
        );
      }
      // 2. Preparar dados da tarefa
      const taskNotes = [
        `Automated: ${config.isolation.automationTag}`,
        `Phase: ${phase}`,
        `Created by: ${config.isolation.automationOwner}`,
        `OperationID: ${operationId}`,
      ].join(" | ");
      // 3. Criar tarefa via API
      const createdTask = await albiwareClient.createTask(
        projectId,
        {
          name: template.name,
          description: template.description,
          notes: taskNotes,
        },
        {
          operationId,
          audit: this.audit,
          dryRun: config.dryRun,
        }
      );
      this.audit.info(
        `✅ TAREFA CRIADA`,
        {
          operationId,
          projectId,
          taskId: (createdTask as any)?.id || "DRY-RUN",
          taskName: template.name,
          phase,
        }
      );
      return {
        success: true,
        data: {
          taskId: (createdTask as any)?.id,
          taskName: template.name,
        },
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    } catch (error) {
      this.audit.error(
        `❌ ERRO AO CRIAR TAREFA`,
        error as Error,
        {
          operationId,
          projectId,
          taskName: template.name,
          phase,
        }
      );
      return {
        success: false,
        error: (error as Error).message,
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    }
  }
  /**
   * PROCESSAR CONCLUSÃO DE TAREFA
   * Dispara próxima fase se necessário
   */
  async processTaskCompletion(
    projectId: number,
    taskName: string,
    operationId?: string
  ): Promise<OperationResult> {
    operationId = operationId || uuidv4();
    try {
      this.audit.info(
        `✅ TAREFA CONCLUÍDA DETECTADA`,
        {
          operationId,
          projectId,
          taskName,
        }
      );
      // 1. Verificar qual fase está completa
      let nextPhaseToTrigger: CascadePhase | undefined;
      for (const phase of this.config.phases) {
        if (phase.triggerTask === taskName) {
          const nextPhaseIndex = phase.phaseNumber;
          if (nextPhaseIndex < this.config.phases.length) {
            nextPhaseToTrigger = this.config.phases[nextPhaseIndex];
          }
          break;
        }
      }
      if (!nextPhaseToTrigger) {
        this.audit.info(
          `ℹ️  TAREFA NÃO DISPARA FASE`,
          {
            operationId,
            projectId,
            taskName,
          }
        );
        return {
          success: true,
          data: {
            triggered: false,
            taskName,
            reason: "Task does not trigger next phase",
          },
          dryRun: config.dryRun,
          timestamp: new Date(),
        };
      }
      // 2. Disparar próxima fase
      this.audit.info(
        `🚀 DISPARANDO PRÓXIMA FASE`,
        {
          operationId,
          projectId,
          currentPhase: nextPhaseToTrigger.phaseNumber - 1,
          nextPhase: nextPhaseToTrigger.phaseNumber,
        }
      );
      const project = await albiwareClient.getProject(projectId, {
        operationId,
        audit: this.audit,
      });
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      const phaseResult = await this.createPhase(
        projectId,
        project,
        nextPhaseToTrigger,
        operationId
      );
      return {
        success: phaseResult.success,
        data: {
          triggered: true,
          taskName,
          nextPhase: nextPhaseToTrigger.phaseNumber,
          phaseResult,
        },
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    } catch (error) {
      this.audit.error(
        `❌ ERRO AO PROCESSAR CONCLUSÃO DE TAREFA`,
        error as Error,
        {
          operationId,
          projectId,
          taskName,
        }
      );
      return {
        success: false,
        error: (error as Error).message,
        dryRun: config.dryRun,
        timestamp: new Date(),
      };
    }
  }
  /**
   * OBTER CONFIGURAÇÃO DE CASCATA
   */
  getConfiguration(): CascadeConfiguration {
    return this.config;
  }
  /**
   * OBTER FASES
   */
  getPhases(): CascadePhase[] {
    return this.config.phases;
  }
  /**
   * OBTER TAREFAS DE UMA FASE
   */
  getTasksForPhase(phaseNumber: TaskPhase): TaskTemplate[] {
    const phase = this.config.phases.find((p) => p.phaseNumber === phaseNumber);
    return phase?.tasks || [];
  }
}
/**
 * EXPORTAR INSTÂNCIA SINGLETON
 */
export const cascadeService = new CascadeService();
export default cascadeService;
