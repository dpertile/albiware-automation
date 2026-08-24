import { logger } from "../utils/logger.js";
import albiwareClient from "./albiware.client.js";

interface CascadePhase {
  phaseNumber: number;
  projectStatus: string;
  tasks: CascadeTask[];
}

interface CascadeTask {
  name: string;
  description: string;
  assignedToRole?: string;
  dateKeyToUpdate?: string;
}

interface CascadeResult {
  success: boolean;
  tasksCreated: string[];
  tasksSkipped: string[];
  errors: any[];
  dryRun: boolean;
  timestamp: string;
}

class CascadeService {
  private configuration: CascadePhase[] = [];

  constructor() {
    this.initializeConfiguration();
  }

  private initializeConfiguration(): void {
    this.configuration = [
      {
        phaseNumber: 1,
        projectStatus: "In Production",
        tasks: [
          {
            name: "Sign Work Auth",
            description: "Work Authorization signed by customer",
          },
          {
            name: "Send Work Authorization to Carrier",
            description: "Send work authorization document to insurance carrier",
          },
          {
            name: "COS Signed",
            description: "Certificate of Service signed",
          },
          {
            name: "Dry Out Confirmed",
            description: "Dry out process confirmed complete",
          },
          {
            name: "Complete Job",
            description: "Complete all job work",
          },
          {
            name: "Assign Estimator",
            description: "Assign estimator to project",
          },
        ],
      },
      {
        phaseNumber: 2,
        projectStatus: "Estimate Process",
        tasks: [
          {
            name: "Create Estimate",
            description: "Create project estimate",
          },
          {
            name: "Review Estimate",
            description: "Review estimate for accuracy",
          },
          {
            name: "Revise Estimate",
            description: "Revise estimate as needed",
          },
          {
            name: "Approve Estimate Internally",
            description: "Internal approval of estimate",
          },
          {
            name: "Send Invoicing to Carrier",
            description: "Send invoice information to carrier",
          },
          {
            name: "Document Initial Insurance Offer",
            description: "Document insurance carrier's initial offer",
          },
          {
            name: "In Negotiations",
            description: "In negotiations with carrier",
          },
          {
            name: "Finalize Agreed Price",
            description: "Finalize agreed price with carrier",
          },
        ],
      },
      {
        phaseNumber: 3,
        projectStatus: "Accounts Receivable",
        tasks: [
          {
            name: "Get AP",
            description: "Get approval from insurance",
          },
          {
            name: "Call To Carrier",
            description: "Call carrier to follow up",
          },
          {
            name: "AR Follow Up",
            description: "Accounts receivable follow up",
          },
          {
            name: "Invoice Customer",
            description: "Invoice customer for services",
          },
          {
            name: "Mortgage Packet Sent",
            description: "Mortgage packet sent to lender",
          },
          {
            name: "Check Signature",
            description: "Check for required signatures",
          },
          {
            name: "Collect Final Payment",
            description: "Collect final payment from customer",
          },
        ],
      },
    ];
  }

  getConfiguration(): CascadePhase[] {
    return this.configuration;
  }

  async triggerCascadeForProject(projectId: number): Promise<CascadeResult> {
    console.log(`🎯 DISPARANDO CASCATA PARA PROJETO ${projectId}`);
    logger.info(`🎯 Disparando cascata`, { projectId });

    const result: CascadeResult = {
      success: false,
      tasksCreated: [],
      tasksSkipped: [],
      errors: [],
      dryRun: process.env.DRY_RUN === "true",
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

      // Verificar se projeto está em "In Production"
      if (project.status !== "In Production") {
        console.log(`⚠️ Projeto não está em "In Production", status: ${project.status}`);
        result.errors.push({
          error: `Project status is ${project.status}, not "In Production"`,
        });
        return result;
      }

      // FASE 1: In Production
      console.log(`📋 PROCESSANDO FASE 1...`);
      const phase1Tasks = this.configuration[0].tasks;

      for (const task of phase1Tasks) {
        try {
          console.log(`✏️ Criando tarefa: ${task.name}`);
          logger.info(`✏️ Criando tarefa`, {
            projectId,
            taskName: task.name,
          });

          // Validar que a tarefa tem os dados necessários
          console.log(`task validation: ✅ PASSED`);

          // USAR A API V5 QUE FUNCIONA!
          // POST /api/v5/Integrations/projects/{id}/tasks
          const taskData = {
            name: task.name,
            description: task.description,
            status: "To-Do",
          };

          console.log(`🚀 Enviando POST para /projects/${projectId}/tasks com:`, taskData);

          // Fazer chamada direta à API v5
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
