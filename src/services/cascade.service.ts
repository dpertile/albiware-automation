import { logger } from "../utils/logger.js";
import albiwareClient from "./albiware.client.js";

interface CascadeResult {
  success: boolean;
  projectId: number;
  projectName: string;
  trigger: string;
  timestamp: string;
  message: string;
}

class CascadeService {
  private triggerMap: { [key: string]: string } = {
    "Work Authorization Signed": "Work Authorization Signed",
    "Work Complete": "Work Complete",
    "Estimate Approved": "AP Approved",
  };

  async triggerCascadeForProject(projectId: number): Promise<CascadeResult> {
    console.log(`🎯 ANALISANDO PROJETO ${projectId}`);
    logger.info(`🎯 Analisando projeto`, { projectId });

    const result: CascadeResult = {
      success: false,
      projectId: projectId,
      projectName: "",
      trigger: "Unknown",
      timestamp: new Date().toISOString(),
      message: "",
    };

    try {
      // Buscar informações do projeto
      console.log(`📋 Buscando projeto ${projectId}...`);
      const project = await albiwareClient.getProject(projectId);
      console.log(`✅ Projeto encontrado:`, project?.name || project?.id);

      if (!project) {
        console.log(`❌ Projeto não encontrado!`);
        result.message = `Project ${projectId} not found`;
        return result;
      }

      result.projectName = project.name || `Project ${projectId}`;

      // Determinar qual trigger foi disparado baseado nas datas preenchidas
      let activeTrigger = "Created At";

      if (project["Work Authorization Signed"] || project.workAuthorizationSigned) {
        activeTrigger = "Work Authorization Signed";
      }
      if (project["Work Complete"] || project.workComplete) {
        activeTrigger = "Work Complete";
      }
      if (project["Estimate Approved"] || project.estimateApproved) {
        activeTrigger = "AP Approved";
      }

      result.trigger = activeTrigger;

      console.log(`🔍 Trigger detectado: ${result.trigger}`);
      logger.info(`🔍 Trigger detectado`, { 
        projectId, 
        projectName: result.projectName,
        trigger: result.trigger 
      });

      result.success = true;
      result.message = `Trigger detected: ${result.trigger}. Zapier will create the tasks.`;

      console.log(`✅ TRIGGER IDENTIFICADO COM SUCESSO!`);
      console.log(`📝 Zapier será acionado para criar as tarefas`);

      return result;
    } catch (error: any) {
      console.log(`❌ ERRO AO ANALISAR PROJETO:`, error?.message || error);
      logger.error("❌ Erro ao analisar projeto", error);

      result.message = error?.message || "Unknown error";
      return result;
    }
  }
}

const cascadeService = new CascadeService();

export default cascadeService;
