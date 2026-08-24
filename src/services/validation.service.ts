import { v4 as uuidv4 } from "uuid";
import { config } from "../config/index.js";
import { createAuditLogger, AuditLogger } from "../utils/logger.js";
import {
  Project,
  ProjectType,
  ProjectPhase,
  TaskPhase,
  Task,
  ValidationResult,
  TaskValidation,
  DateValidation,
  StaffMember,
<<<<<<< HEAD
} from "../types/index.js";
import albiwareClient from "./albiware.client";

=======
} from "../types";
import albiwareClient from "./albiware.client.js";
>>>>>>> 2f4c447443261ae7aa08944367329317a3b22e60
/**
 * SERVIÇO DE VALIDAÇÃO
 *
 * Antes de qualquer ação (criar task, atualizar data, etc),
 * este serviço valida que é seguro fazer isso.
 *
 * Features:
 * - Validação de projeto
 * - Validação de tarefa (não duplicar)
 * - Validação de datas
 * - Validação de responsáveis
 * - Detecção de conflitos com webhooks
 * - Isolamento de dados
 */
export class ValidationService {
  private audit: AuditLogger;
  private projectCache = new Map<number, Project>();
  private staffCache = new Map<number, StaffMember>();
  private webhookCache: number[] = [];
  constructor() {
    this.audit = createAuditLogger({
      automationId: "validation-service",
      dryRun: config.dryRun,
    });
  }
  /**
   * VALIDAR CRIAÇÃO DE TAREFA
   *
   * Checklist:
   * 1. Projeto existe?
   * 2. Projeto é tipo aplicável?
   * 3. Projeto está em fase correta?
   * 4. Tarefa já existe? (não duplicar!)
   * 5. Responsável existe?
   * 6. Webhooks vão reagir?
   */
  async validateTaskCreation(
    projectId: number,
    taskName: string,
    phase: TaskPhase,
    expectedProjectPhase: ProjectPhase,
    assignedToId?: number
  ): Promise<TaskValidation> {
    const validationId = uuidv4();
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      // 1. Projeto existe?
      const project = await this.getProject(projectId);
      if (!project) {
        errors.push(`Project ${projectId} not found`);
        return {
          projectExists: false,
          projectTypeApplicable: false,
          projectInCorrectPhase: false,
          taskNotDuplicate: false,
          assigneeExists: false,
          allChecks: {
            valid: false,
            errors,
            warnings,
          },
        };
      }
      // 2. Projeto é tipo aplicável?
      const projectTypeApplicable = config.cascade.projectTypes.includes(
        project.projectType as ProjectType
      );
      if (!projectTypeApplicable) {
        errors.push(
          `Project type "${project.projectType}" not in automation scope`
        );
      }
      // 3. Projeto está em fase correta?
      const projectInCorrectPhase = project.status === expectedProjectPhase;
      if (!projectInCorrectPhase) {
        errors.push(
          `Project status "${project.status}" != expected "${expectedProjectPhase}"`
        );
      }
      // 4. Tarefa já existe? (IMPORTANTE!)
      const existingTasks = await albiwareClient.getTasks(projectId, {
        audit: this.audit,
      });
      const taskExists = existingTasks.some(
        (t) =>
          t.name.toLowerCase() === taskName.toLowerCase() ||
          (t.notes?.includes(config.isolation.automationTag) &&
            t.name.toLowerCase() === taskName.toLowerCase())
      );
      const taskNotDuplicate = !taskExists;
      if (taskExists) {
        warnings.push(
          `Task "${taskName}" already exists in this project (will skip creation)`
        );
      }
      // 5. Responsável existe?
      let assigneeExists = true;
      if (assignedToId) {
        const staff = await this.getStaffMember(assignedToId);
        assigneeExists = !!staff;
        if (!staff) {
          errors.push(`Staff member ${assignedToId} not found`);
        }
      }
      // 6. Webhooks vão reagir?
      const webhooksWillTrigger = await this.checkWebhookTriggers(
        "task.created"
      );
      if (webhooksWillTrigger.length > 0) {
        warnings.push(
          `${webhooksWillTrigger.length} webhook(s) will be triggered by task creation: [${webhooksWillTrigger.join(
            ", "
          )}]`
        );
      }
      const valid =
        projectTypeApplicable &&
        projectInCorrectPhase &&
        taskNotDuplicate &&
        assigneeExists;
      const result: TaskValidation = {
        projectExists: !!project,
        projectTypeApplicable,
        projectInCorrectPhase,
        taskNotDuplicate,
        assigneeExists,
        allChecks: {
          valid,
          errors,
          warnings,
          data: {
            webhooksWillTrigger,
            conflictRisk:
              webhooksWillTrigger.length > 0 &&
              config.webhooks.collisionCheck,
          },
        },
      };
      this.audit.logValidation("task", taskName, valid, errors);
      return result;
    } catch (error) {
      this.audit.error(
        `Task validation failed for "${taskName}"`,
        error as Error
      );
      return {
        projectExists: false,
        projectTypeApplicable: false,
        projectInCorrectPhase: false,
        taskNotDuplicate: false,
        assigneeExists: false,
        allChecks: {
          valid: false,
          errors: [
            ...errors,
            `Validation error: ${(error as Error).message}`,
          ],
          warnings,
        },
      };
    }
  }
  /**
   * VALIDAR ATUALIZAÇÃO DE DATA
   *
   * Checklist:
   * 1. Projeto existe?
   * 2. Data key é válida?
   * 3. Não vai sobrescrever data já preenchida?
   * 4. Projeto está em fase correta?
   * 5. Zapier (ou outros webhooks) vai reagir?
   */
  async validateDateUpdate(
    projectId: number,
    dateKey: string,
    newValue: string,
    allowOverwrite = false
  ): Promise<DateValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      // 1. Projeto existe?
      const project = await this.getProject(projectId);
      if (!project) {
        errors.push(`Project ${projectId} not found`);
        return {
          projectExists: false,
          dateKeyValid: false,
          noOverwrite: false,
          inCorrectPhase: false,
          noConflictWithZapier: false,
          allChecks: {
            valid: false,
            errors,
            warnings,
          },
        };
      }
      // 2. Data key é válida? (lista conhecida)
      const validDateKeys = [
        "dateOfLoss",
        "firstContacted",
        "estimatedWorkStartDate",
        "arrivedOnSite",
        "scheduledInspection",
        "inspectionDate",
        "contractSigned",
        "workStart",
        "estimatedCompletionDate",
        "workComplete",
        "cocSigned",
        "estimateSent",
        "estimateApproved",
        "invoiced",
        "paid",
        "finalFileReview",
        "fileClosed",
        "lost",
        // Variações
        "Work Authorization Signed",
        "Work Start",
        "Work Authorization Sent",
        "Coc/Cos Signed",
        "Dry Out Confirmed",
        "Work Complete",
        "Estimator Assigned",
        "Estimated Completion Date",
        "Estimate Reviewed",
        "Final File Review",
        "Estimate Approved",
        "Invoiced Carrier",
        "Insurance Offer",
        "Negotiations Started",
        "AP Approved",
        "AP Received",
        "First AR Follow Up Completed",
        "AR Follow Up Completed",
        "Invoiced Customer",
        "Mortgage Packet Sent",
        "Check Signed",
        "Final Paid Date/Date Closed",
      ];
      const dateKeyValid = validDateKeys.includes(dateKey);
      if (!dateKeyValid) {
        errors.push(
          `Unknown date key: "${dateKey}" (not in valid date list)`
        );
      }
      // 3. Não vai sobrescrever data?
      const currentDates = await albiwareClient.getProjectDates(projectId, {
        audit: this.audit,
      });
      const currentDate = currentDates.find(
        (d) => d.dateKey === dateKey || d.label === dateKey
      );
      const noOverwrite =
        !currentDate?.dateValue || allowOverwrite ? true : false;
      if (currentDate?.dateValue && !allowOverwrite) {
        warnings.push(
          `Date "${dateKey}" already has value "${currentDate.dateValue}" (will not overwrite unless explicitly allowed)`
        );
      }
      // 4. Projeto está em fase correta?
      // (Não há restrição específica, mas logar para auditoria)
      const inCorrectPhase = !!project;
      // 5. Zapier vai reagir?
      const webhooksWillTrigger = await this.checkWebhookTriggers(
        "project.date.updated"
      );
      const noConflictWithZapier = !(
        webhooksWillTrigger.length > 0 && config.webhooks.collisionCheck
      );
      if (webhooksWillTrigger.length > 0) {
        warnings.push(
          `Date update will trigger ${webhooksWillTrigger.length} webhook(s): [${webhooksWillTrigger.join(
            ", "
          )}]`
        );
        if (config.webhooks.collisionCheck) {
          warnings.push(
            `⚠️ ZAPIER WEBHOOK DETECTED: This date update may conflict with existing automation`
          );
        }
      }
      const valid =
        project &&
        dateKeyValid &&
        noOverwrite &&
        inCorrectPhase;
      const result: DateValidation = {
        projectExists: !!project,
        dateKeyValid,
        noOverwrite,
        inCorrectPhase,
        noConflictWithZapier,
        allChecks: {
          valid,
          errors,
          warnings,
          data: {
            webhooksWillTrigger,
            conflictRisk:
              webhooksWillTrigger.length > 0 &&
              config.webhooks.collisionCheck,
          },
        },
      };
      this.audit.logValidation("date", dateKey, valid, errors);
      return result;
    } catch (error) {
      this.audit.error(
        `Date validation failed for "${dateKey}"`,
        error as Error
      );
      return {
        projectExists: false,
        dateKeyValid: false,
        noOverwrite: false,
        inCorrectPhase: false,
        noConflictWithZapier: false,
        allChecks: {
          valid: false,
          errors: [
            ...errors,
            `Validation error: ${(error as Error).message}`,
          ],
          warnings,
        },
      };
    }
  }
  /**
   * VERIFICAR QUAIS WEBHOOKS VÃO SER DISPARADOS
   */
  private async checkWebhookTriggers(eventType: string): Promise<number[]> {
    try {
      if (this.webhookCache.length === 0) {
        const webhooks = await albiwareClient.getWebhooks({
          audit: this.audit,
        });
        this.webhookCache = webhooks.map((w) => w.id);
      }
      // Filtra webhooks conhecidos que subscrevem ao evento
      return config.webhooks.knownWebhookIds.filter(
        (id) =>
          this.webhookCache.includes(id) &&
          this.isKnownWebhookSubscribedTo(id, eventType)
      );
    } catch (error) {
      this.audit.error(
        `Failed to check webhook triggers for ${eventType}`,
        error as Error
      );
      return [];
    }
  }
  /**
   * VERIFICAR SE WEBHOOK CONHECIDO SUBSCREVEU AO EVENTO
   */
  private isKnownWebhookSubscribedTo(webhookId: number, eventType: string): boolean {
    // Zapier (ID 15802) subscreveu a "project.date.updated"
    if (webhookId === 15802) {
      return eventType === "project.date.updated";
    }
    // Adicionar outros webhooks conhecidos conforme necessário
    return false;
  }
  /**
   * CACHE: GET PROJECT
   */
  private async getProject(projectId: number): Promise<Project | null> {
    if (this.projectCache.has(projectId)) {
      return this.projectCache.get(projectId) || null;
    }
    try {
      const project = await albiwareClient.getProject(projectId, {
        audit: this.audit,
      });
      this.projectCache.set(projectId, project);
      return project;
    } catch (error) {
      this.audit.error(`Failed to get project ${projectId}`, error as Error);
      return null;
    }
  }
  /**
   * CACHE: GET STAFF MEMBER
   */
  private async getStaffMember(
    staffId: number
  ): Promise<StaffMember | null> {
    if (this.staffCache.has(staffId)) {
      return this.staffCache.get(staffId) || null;
    }
    try {
      const staff = await albiwareClient.getStaffMember(staffId, {
        audit: this.audit,
      });
      this.staffCache.set(staffId, staff);
      return staff;
    } catch (error) {
      this.audit.error(`Failed to get staff ${staffId}`, error as Error);
      return null;
    }
  }
  /**
   * LIMPAR CACHE (quando necessário forçar refresh)
   */
  clearCache(): void {
    this.projectCache.clear();
    this.staffCache.clear();
    this.webhookCache = [];
    this.audit.info("Cache cleared");
  }
}
/**
 * EXPORTAR INSTÂNCIA SINGLETON
 */
export const validationService = new ValidationService();
export default validationService;
