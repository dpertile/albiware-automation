import axios, { AxiosInstance } from "axios";
import { logger } from "../utils/logger.js";

interface RequestOptions {
  audit?: any;
  maxRetries?: number;
}

class AlbiwareClient {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private maxRetries: number = 3;

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ) {
    const maxRetries = options?.maxRetries || this.maxRetries;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client({
          method,
          url: endpoint,
          data,
        });

        return response.data;
      } catch (error: any) {
        lastError = error;

        logger.warn(`⚠️ Tentativa ${attempt + 1}/${maxRetries} falhou`, {
          endpoint,
          error: error?.message,
        });

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    logger.error("❌ Falha após retries", { endpoint, error: lastError?.message });
    throw lastError;
  }

  async getProjects(limit: number = 100, options?: RequestOptions) {
    try {
      logger.info("📋 Buscando projetos...");
      const response = await this.makeRequest("GET", `/projects?limit=${limit}`, undefined, options);
      const projects = response?.data || response || [];
      console.log(`📊 API retornou ${Array.isArray(projects) ? projects.length : 0} projetos`);
      return Array.isArray(projects) ? projects : [];
    } catch (error) {
      logger.error("❌ Erro ao buscar projetos", error);
      return [];
    }
  }

  async getProject(projectId: number, options?: RequestOptions) {
    try {
      logger.info(`📋 Buscando projeto ${projectId}...`);
      return await this.makeRequest("GET", `/projects/${projectId}`, undefined, options);
    } catch (error) {
      logger.error(`❌ Erro ao buscar projeto ${projectId}`, error);
      throw error;
    }
  }

  async getTasks(projectId: number, options?: RequestOptions) {
    try {
      logger.info(`📋 Buscando tarefas do projeto ${projectId}...`);
      const response = await this.makeRequest("GET", `/projects/${projectId}/tasks`, undefined, options);
      const tasks = response?.data || response || [];
      return Array.isArray(tasks) ? tasks : [];
    } catch (error) {
      logger.error(`❌ Erro ao buscar tarefas`, error);
      return [];
    }
  }

  async createTask(projectId: number, taskData: any, options?: RequestOptions) {
    try {
      logger.info(`✏️ Criando tarefa no projeto ${projectId}...`);
      return await this.makeRequest("POST", `/projects/${projectId}/tasks`, taskData, options);
    } catch (error) {
      logger.error(`❌ Erro ao criar tarefa`, error);
      throw error;
    }
  }

  async getWebhooks(options?: RequestOptions) {
    try {
      logger.info("🪝 Buscando webhooks...");
      const response = await this.makeRequest("GET", `/webhooks`, undefined, options);
      const webhooks = response?.data || response || [];
      return Array.isArray(webhooks) ? webhooks : [];
    } catch (error) {
      logger.error("❌ Erro ao buscar webhooks", error);
      return [];
    }
  }
}

const albiwareClient = new AlbiwareClient(
  process.env.ALBIWARE_API_BASE_URL || "https://api.albiware.com/v5/Integrations",
  process.env.ALBIWARE_API_KEY || ""
);

export default albiwareClient;
