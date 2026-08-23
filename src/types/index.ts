/**
 * TIPOS E INTERFACES ALBIWARE AUTOMATION
 * Compartilhados em toda a aplicação
 */

// ============================================================
// ENUMS
// ============================================================

export enum ProjectType {
  BIOHAZARD = "Biohazard",
  EMERGENCY_SERVICES = "Emergency Services",
  MOLD = "Mold",
  SEWAGE = "Sewage",
  STRUCTURAL_CLEANING = "Structural Cleaning",
  WATER = "Water",
}

export enum ProjectPhase {
  NEW = "New",
  IN_PRODUCTION = "In Production",
  ESTIMATE_PROCESS = "Estimate Process",
  ACCOUNTS_RECEIVABLE = "Accounts Receivable",
  COMPLETED = "Completed",
  LOST = "Lost",
}

export enum TaskPhase {
  PHASE_1_PRODUCTION = 1,
  PHASE_2_ESTIMATE = 2,
  PHASE_3_AR = 3,
}

export enum TaskStatus {
  NOT_STARTED = "Not Started",
  IN_PROGRESS = "In Progress",
  COMPLETED = "Completed",
  BLOCKED = "Blocked",
}

export enum AutomationEventType {
  TASK_CREATED = "task.created",
  TASK_COMPLETED = "task.completed",
  DATE_UPDATED = "date.updated",
  PROJECT_STATUS_CHANGED = "project.status.changed",
  PHASE_TRIGGERED = "phase.triggered",
  ERROR_OCCURRED = "error.occurred",
  CONFLICT_DETECTED = "conflict.detected",
}

export enum AuditActionType {
  CREATE_TASK = "CREATE_TASK",
  UPDATE_DATE = "UPDATE_DATE",
  TRIGGER_PHASE = "TRIGGER_PHASE",
  VALIDATE_TASK = "VALIDATE_TASK",
  DETECT_CONFLICT = "DETECT_CONFLICT",
  PAUSE_AUTOMATION = "PAUSE_AUTOMATION",
  RESUME_AUTOMATION = "RESUME_AUTOMATION",
  ROLLBACK_ACTION = "ROLLBACK_ACTION",
}

// ============================================================
// INTERFACES - ALBIWARE API
// ============================================================

export interface Project {
  id: number;
  identifier: string;
  name: string;
  customerName: string;
  projectType: string;
  status: string;
  statusDate: string | null;
  projectManager: string;
  projectManagerEmail: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  closed: string;
  closedBoolean: boolean;
  url: string;
}

export interface Task {
  id: number;
  identifier: string;
  projectId: number;
  name: string;
  description?: string;
  status: string;
  assignedTo?: string;
  assignedToId?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface StaffMember {
  id: number;
  identifier: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles?: string[];
  active: boolean;
}

export interface ProjectDate {
  dateKey: string;
  dateValue: string | null;
  label: string;
}

export interface Webhook {
  id: number;
  webhookUrl: string;
  scopes: string[];
  createdAt: string;
}

// ============================================================
// INTERFACES - AUTOMAÇÃO
// ============================================================

export interface TaskTemplate {
  name: string;
  description: string;
  assignedToId?: number;
  assignedToRole?: string; // "Lead Project Manager", "Lead Estimator", etc
  phase: TaskPhase;
  dateKeyToUpdate?: string; // qual data preencher ao completar
  precedingTask?: string; // qual tarefa precisa estar completa antes
}

export interface CascadePhase {
  phaseNumber: TaskPhase;
  projectStatus: ProjectPhase;
  tasks: TaskTemplate[];
  triggerTask?: string; // qual task completa dispara próxima fase
  triggerDateKey?: string; // qual data preencher dispara próxima fase
}

export interface CascadeConfiguration {
  projectTypes: ProjectType[];
  phases: CascadePhase[];
  assignmentRules: {
    [key: string]: {
      defaultStaffId?: number;
      defaultRole?: string;
      canReassign?: boolean;
    };
  };
}

export interface AutomationState {
  projectId: number;
  currentPhase: TaskPhase | null;
  lastTriggeredAt?: Date;
  completedTasks: string[];
  failedTasks: { name: string; error: string }[];
  status: "idle" | "running" | "paused" | "error";
}

// ============================================================
// INTERFACES - VALIDAÇÃO
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: {
    webhooksWillTrigger?: number[];
    conflictRisk?: boolean;
  };
}

export interface TaskValidation {
  projectExists: boolean;
  projectTypeApplicable: boolean;
  projectInCorrectPhase: boolean;
  taskNotDuplicate: boolean;
  assigneeExists: boolean;
  allChecks: ValidationResult;
}

export interface DateValidation {
  projectExists: boolean;
  dateKeyValid: boolean;
  noOverwrite: boolean; // não sobrescrever se já preenchido
  inCorrectPhase: boolean;
  noConflictWithZapier: boolean;
  allChecks: ValidationResult;
}

// ============================================================
// INTERFACES - AUDIT LOG
// ============================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  automationId: string;
  userId: string;
  action: AuditActionType;
  projectId: number;
  projectName: string;
  taskId?: number;
  taskName?: string;
  dateKey?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  success: boolean;
  error?: string;
  dryRun: boolean;
  webhooksTriggered?: number[];
  sourceWebhook?: string;
  duration: number; // ms
  metadata?: Record<string, any>;
}

export interface ConflictLog {
  id: string;
  timestamp: Date;
  projectId: number;
  automationAction: AuditActionType;
  expectedWebhook?: number; // webhook que deveria disparar
  actualWebhooksFired?: number[]; // webhooks que realmente dispararam
  conflictType: "unexpected_webhook" | "missing_webhook" | "data_mismatch";
  description: string;
  resolved: boolean;
  resolution?: string;
}

// ============================================================
// INTERFACES - API REQUEST/RESPONSE
// ============================================================

export interface ApiResponse<T = any> {
  data?: T;
  message: string;
  status: number;
  validationErrors?: Record<string, string[]>;
  trackId?: string;
  continuationToken?: string;
}

export interface WebhookPayload {
  eventType: AutomationEventType;
  projectId: number;
  projectName: string;
  timestamp: Date;
  data: Record<string, any>;
  sourceAutomation: boolean;
}

export interface WebhookRequest {
  id: string;
  timestamp: Date;
  projectId: number;
  eventType: string;
  data: Record<string, any>;
  sourceWebhookId?: number;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

// ============================================================
// INTERFACES - CONFIGURAÇÃO
// ============================================================

export interface Config {
  environment: "development" | "staging" | "production";
  dryRun: boolean;
  validateAllActions: boolean;
  logAllRequests: boolean;
  enableRollback: boolean;
  enableAlerts: boolean;

  api: {
    key: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    retryBackoffMs: number;
  };

  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };

  rateLimiting: {
    maxRequestsPerSecond: number;
    maxTasksPerHour: number;
    maxDatesPerHour: number;
  };

  monitoring: {
    enableAuditLog: boolean;
    enableAlerts: boolean;
    alertOnError: boolean;
    alertChannels: ("slack" | "email")[];
    slackWebhookUrl?: string;
    emailRecipients?: string[];
  };

  isolation: {
    automationTag: string;
    automationOwner: string;
    isolationMode: "strict" | "moderate" | "loose";
  };

  webhooks: {
    knownWebhookIds: number[];
    collisionCheck: boolean;
    conflictAction: "pause_automation" | "log_only" | "continue";
  };

  cascade: {
    projectTypes: ProjectType[];
    defaultAssignments: {
      phase1Lead?: string;
      phase2Lead?: string;
      phase3Lead?: string;
    };
  };
}

// ============================================================
// INTERFACES - RESPOSTA DE OPERAÇÕES
// ============================================================

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, any>;
  auditLogId?: string;
  dryRun: boolean;
  timestamp: Date;
}

export interface BulkOperationResult {
  totalOperations: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: { index: number; error: string }[];
  auditLogIds: string[];
  dryRun: boolean;
}

// ============================================================
// TIPOS ÚTEIS
// ============================================================

export type TaskCreationInput = Omit<
  Task,
  "id" | "identifier" | "createdAt" | "updatedAt"
>;

export type DateUpdateInput = {
  dateKey: string;
  dateValue: string;
};

export type WebhookEventHandler = (
  payload: WebhookPayload
) => Promise<OperationResult>;

export type ValidatorFunction = (
  data: any
) => Promise<ValidationResult>;
