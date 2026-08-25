import { logger } from "../utils/logger.js";
import albiwareClient from "./albiware.client.js";

interface CascadePhase {
  phaseNumber: number;
  trigger: string;
  tasks: CascadeTask[];
}

interface CascadeTask {
  name: string;
  description: string;
  assignedTo: string;
  dateToFill: string;
}

interface CascadeResult {
  success: boolean;
  tasksCreated: string[];
  tasksSkipped: string[];
  errors: any[];
  trigger: string;
  timestamp: string;
}

class CascadeService {
  private configuration: CascadePhase[] = [];
  private staffMap: { [key: string]: number } = {
    Donna: 1,
    Technician: 2,
    Brendan: 3,
    Daniel: 4,
    Holly: 5,
  };

  constructor() {
    this.initializeConfiguration();
  }

  private initializeConfiguration(): void {
    this.configuration = [
      {
        phaseNumber: 1,
        trigger: "Created At",
        tasks: [
          {
            name: "Sign Work Auth",
            description: "Work Authorization to be signed",
            assignedTo: "Donna",
            dateToFill: "Work Authorization Signed",
          },
        ],
      },
      {
        phaseNumber: 2,
        trigger: "Work Authorization Signed",
        tasks: [
          {
            name: "Send Work Authorization to Carrier",
            description: "Send work authorization to insurance carrier",
            assignedTo: "Donna",
            dateToFill: "Work Auth Sent",
          },
          {
            name: "COS Signed",
            description: "Certificate of Service to be signed",
            assignedTo: "Donna",
            dateToFill: "Coc/Cos Signed",
          },
          {
            name: "Dry Out Confirmed",
            description: "Confirm dry out process complete",
            assignedTo: "Technician",
            dateToFill: "Dry Out Confirmed",
          },
          {
            name: "Complete Job",
            description: "Complete all job work",
            assignedTo: "Donna",
            dateToFill: "Work Complete",
          },
        ],
      },
      {
        phaseNumber: 3,
        trigger: "Work Complete",
        tasks: [
          {
            name: "Create Estimate",
            description: "Create project estimate",
            assignedTo: "Brendan",
            dateToFill: "Estimated Completion Date",
          },
          {
            name: "Review Estimate",
            description: "Review estimate for accuracy",
            assignedTo: "Brendan",
            dateToFill: "Estimate Reviewed",
          },
          {
            name: "Revise Estimate",
            description: "Revise estimate as needed",
            assignedTo: "Brendan",
            dateToFill: "Final File Review",
          },
          {
            name: "Approve Estimate Internally",
            description: "Internal approval of estimate",
            assignedTo: "Brendan",
            dateToFill: "Estimate Approved",
          },
          {
            name: "Send Invoicing to Carrier",
            description: "Send invoice to carrier",
            assignedTo: "Brendan",
            dateToFill: "Invoiced Carrier",
          },
          {
            name: "Document Initial Insurance Offer",
            description: "Document insurance offer details",
            assignedTo: "Brendan",
            dateToFill: "Insurance Offer",
          },
          {
            name: "In Negotiations",
            description: "Negotiate with insurance carrier",
            assignedTo: "Brendan",
            dateToFill: "Negotiations Started",
          },
          {
            name: "Finalize Agreed Price",
            description: "Finalize agreed price with carrier",
            assignedTo: "Brendan",
            dateToFill: "AP Approved",
          },
        ],
      },
      {
        phaseNumber: 4,
        trigger: "AP Approved",
        tasks: [
          {
            name: "Get AP",
            description: "Get approval from insurance",
            assignedTo: "Daniel",
            dateToFill: "AP Received",
          },
          {
            name: "Call To Carrier",
            description: "Call carrier to follow up",
            assignedTo: "Daniel",
            dateToFill: "First AR Follow Up Completed",
          },
          {
            name: "AR Follow Up",
            description: "Accounts receivable follow up",
            assignedTo: "Daniel",
            dateToFill: "AR Follow Up Completed",
          },
          {
            name: "Invoice Customer",
            description: "Invoice customer for services",
            assignedTo: "Daniel",
            dateToFill: "Invoiced Customer",
          },
          {
            name: "Mortgage Packet Sent",
            description: "Send mortgage packet to lender",
            assignedTo: "Daniel",
            dateToFill: "Mortgage Packet Sent",
          },
          {
            name: "Check Signature",
            description: "Verify all required signatures",
            assignedTo: "Daniel",
            dateToFill: "Check Signed",
          },
          {
            name: "Collect Final Payment",
            description: "Collect final payment from customer",
            assignedTo: "Holly",
            dateToFill: "Final Paid Date/Date Closed",
          },
        ],
      },
    ];
  }

  getConfiguration(): CascadePhase[] {
    return this.configuration;
  }

  private getTriggerFromDateField(dateField: string): string {
    const triggerMap: { [key: string]: string } = {
      "Work Authorization Signed": "Work Authorization Signed",
      "Work Start": "Work Authorization Signed",
      "Work Complete": "Work Complete",
      "Estimate Approved": "AP Approved",
    };

    return triggerMap[dateField] || "";
  }

  async triggerCascadeForProject(projectId: number): Promise<CascadeResult> {
    console.log(`🎯 DISPARANDO CASCATA PARA PROJETO ${projectId}`);
    logger.info(`🎯 Disparando cascata`, { projectId });

    const result: CascadeResult = {
      success: false,
      tasksCreated: [],
      tasksSkipped: [],
      errors: [],
      trigger: "Unknown",
      timestamp: new Date().toISOString(),
    };

    try {
      // Buscar informações do projeto
      console.log(`📋 Buscando projeto ${projectId}...`);
      const project = await albiwareClient.getProject(projectId);
      console.log(`✅ Projeto encontrado:`, project?.name || project?.id);

      if (!project) {
        console.log(`❌ Projeto não encontrado!`);
        result.errors.push({ error: `Project ${projectId} not found` });
        return result;
      }

      // Determinar qual trigger foi disparado baseado nas datas preenchidas
      let activeTrigger = "";

      if (project["Work Authorization Signed"] || project.workAuthorizationSigned) {
        activeTrigger = "Work Authorization Signed";
      }
      if (project["Work Complete"] || project.workComplete) {
        activeTrigger = "Work Complete";
      }
      if (project["Estimate Approved"] || project.estimateApproved) {
        activeTrigger = "AP Approved";
      }
      if (!activeTrigger && (project["Work Start"] || project.workStart)) {
        activeTrigger = "Work Authorization Signed";
      }

      result.trigger = activeTrigger || "Created At";

      console.log(`🔍 Trigger detectado: ${result.trigger}`);
      logger.info(`🔍 Trigger detectado`, { trigger: result.trigger });

      // Encontrar a fase correspondente ao trigger
      const phase = this.configuration.find(p => p.trigger === result.trigger);

      if (!phase) {
        console.log(`⚠️ Nenhuma fase encontrada para trigger: ${result.trigger}`);
        result.errors.push({
          error: `No phase found for trigger: ${result.trigger}`,
        });
        return result;
      }

      console.log(`📋 PROCESSANDO FASE ${phase.phaseNumber}...`);

      // Criar tarefas para esta fase
      for (const task of phase.tasks) {
        try {
          console.log(`✏️ Criando tarefa: ${task.name}`);
          logger.info(`✏️ Criando tarefa`, {
            projectId,
            taskName: task.name,
            assignedTo: task.assignedTo,
          });

          // Obter ID do staff
          const staffId = this.staffMap[task.assignedTo] || 1;

          // Fazer chamada direta à API v5
          const taskData = {
            name: task.name,
            description: task.description,
            status: "To-Do",
            projectId: projectId,
          };

          console.log(`🚀 Enviando POST para /projects/${projectId}/tasks com:`, taskData);

          const response = await fetch(
            `https://api.albiware.com/v5/Integrations/projects/${projectId}/tasks`,
            {
              method: "POST",
              headers: {
                "X-API-KEY": process.env.ALBIWARE_API_KEY || "",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(taskData),
            }
          );

          console.log(`📊 Response status:`, response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`❌ Erro na resposta:`, errorText);
            result.errors.push({
              taskName: task.name,
              status: response.status,
              error: errorText,
            });
            continue;
          }

          const createdTask = await response.json();
          console.log(`✅ Tarefa criada:`, createdTask?.id || createdTask);
          logger.info(`✅ Tarefa criada com sucesso`, {
            taskName: task.name,
            taskId: createdTask?.id,
          });

          result.tasksCreated.push(task.name);
        } catch (taskError: any) {
          console.log(`❌ ERRO AO CRIAR TAREFA:`, taskError?.message || taskError);
          logger.error(`❌ Erro ao criar tarefa`, taskError);

          result.errors.push({
            taskName: task.name,
            error: taskError?.message || "Unknown error",
          });
        }
      }

      console.log(`\n📊 Resultado:`, result);

      result.success = result.tasksCreated.length > 0 && result.errors.length === 0;

      if (result.success) {
        console.log(`✅ CASCATA DISPARADA COM SUCESSO!`);
        logger.info(`✅ Cascata disparada com sucesso`, result);
      } else {
        console.log(
          `⚠️ Cascata não foi disparada (${result.tasksCreated.length} tarefas, ${result.errors.length} erros)`
        );
        logger.warn(`⚠️ Cascata não foi disparada`, result);
      }

      return result;
    } catch (error: any) {
      console.log(`❌ ERRO GERAL NA CASCATA:`, error?.message || error);
      logger.error("❌ Erro geral na cascata", error);

      result.errors.push({
        error: error?.message || "Unknown error",
      });

      return result;
    }
  }
}

const cascadeService = new CascadeService();

export default cascadeService;
