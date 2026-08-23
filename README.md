# 🚀 ALBIWARE AUTOMATION - CASCADE TASKS v1.0.0

Sistema de automação seguro, isolado e production-ready para criação em cascata de tarefas no Albiware.

**Status:** ✅ Pronto para Staging Testing

---

## 📋 Conteúdo

- [O que é](#o-que-é)
- [Features](#features)
- [Segurança](#segurança)
- [Setup Rápido](#setup-rápido)
- [Modo Staging (Teste Seguro)](#modo-staging-teste-seguro)
- [Modo Produção](#modo-produção)
- [Documentação Técnica](#documentação-técnica)
- [Troubleshooting](#troubleshooting)
- [Emergência](#emergência)

---

## O que é

Automação que cria tarefas em cascata (3 fases) quando um projeto é criado no Albiware:

```
Projeto Novo
    ↓
FASE 1: In Production (6 tarefas)
    ↓
Tarefa "Assign Estimator" completa → DISPARA
    ↓
FASE 2: Estimate Process (8 tarefas)
    ↓
Tarefa "Finalize Agreed Price" completa → DISPARA
    ↓
FASE 3: Accounts Receivable (7 tarefas)
    ↓
Projeto Concluído
```

**Aplicável às divisões:**
- Biohazard (TRM)
- Emergency Services (ESR)
- Mold (MLD)
- Sewage (SWG)
- Structural Cleaning (STC)
- Water (WTR)

---

## Features

### ✅ Segurança Enterprise

- **Dry-Run Mode** - Teste sem fazer ações reais
- **Validações Rigorosas** - Antes de CADA ação na API
- **Audit Trail Completo** - Registro de tudo em banco de dados
- **Isolamento Total** - Nossas tasks/datas identificadas com tags
- **Rate Limiting** - Proteção contra throttle
- **Retry Automático** - Com backoff exponencial
- **Detecção de Conflitos** - Com Zapier e outros webhooks

### 📊 Monitoramento

- **Logs Estruturados** - Com Pino (JSON ou Pretty)
- **Alertas Automáticos** - Via Slack/Email
- **Dashboard (Opcional)** - Observabilidade em tempo real
- **Relatórios Diários** - De operações e erros

### 🔄 Operações

- **Criar Tasks em Cascata** - Automático
- **Atualizar Datas de Projeto** - Quando tarefa completa
- **Reassignments** - Suporte a reatribuição de tarefas
- **Webhooks Próprios** - Para integração com sistemas externos

### 🛠️ Manutenção

- **Documentação Técnica Completa** - Como debugar
- **Scripts de Emergência** - Parada/Rollback seguro
- **Testes Automatizados** - Jest
- **Docker** - Deploy em qualquer lugar

---

## Segurança

### 4 Camadas de Proteção

#### 1. **DRY-RUN MODE**
```bash
DRY_RUN=true npm run dev
# → Simula tudo SEM fazer ações reais
# → Perfeito para teste em produção
```

#### 2. **VALIDAÇÕES**
Antes de criar task ou atualizar data:
- ✓ Projeto existe?
- ✓ Tipo de projeto é aplicável?
- ✓ Task já existe? (não duplicar!)
- ✓ Responsável existe?
- ✓ Webhook vai reagir?

#### 3. **AUDIT TRAIL**
Cada ação registra:
```json
{
  "timestamp": "2026-08-23T13:30:45Z",
  "action": "CREATE_TASK",
  "projectId": 2297131,
  "before": { "tasks": 0 },
  "after": { "tasks": 1 },
  "webhooksTriggered": [15802],
  "success": true,
  "dryRun": false
}
```

#### 4. **ISOLAMENTO**
- Nossas tasks têm tag: `automated-cascade`
- Nossas datas têm tag: `automated-date`
- Fácil deletar só nossas ações se necessário
- Outras automações não são afetadas

### ⚠️ Webhooks Conhecidos

| ID | URL | Scope | Risco |
|---|---|---|---|
| 15802 | Zapier | project.date.updated | CRÍTICO |

**Nossa proteção:** Sistema detecta e pausa se Zapier reagir de forma inesperada.

---

## Setup Rápido

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 12+
- Variáveis de ambiente (.env)

### 1. Clonar e Instalar

```bash
git clone <repo>
cd albiware-automation
npm install
```

### 2. Configurar .env

```bash
cp .env.example .env

# Editar .env com suas configurações
nano .env
```

**Mínimo obrigatório:**
```env
NODE_ENV=staging
DRY_RUN=true
ALBIWARE_API_KEY=304784df-ebfe-439c-bb9d-b0bd521f6c9e
DB_PASSWORD=sua_senha_postgres
```

### 3. Setup Database

```bash
# Criar banco de dados
npm run db:migrate

# (Opcional) Seed dados de teste
npm run db:seed
```

### 4. Testar Conexão

```bash
npm run safe-test
# → Testa tudo em DRY_RUN mode
# → Se OK: ✅ pronto para staging
```

---

## Modo Staging (Teste Seguro)

### Configuração Recomendada

```env
NODE_ENV=staging
DRY_RUN=true
VALIDATE_ALL_ACTIONS=true
LOG_ALL_REQUESTS=true
ISOLATION_MODE=strict
WEBHOOK_COLLISION_CHECK=true
WEBHOOK_CONFLICT_ACTION=pause_automation
```

### Teste 1: Verificar Conexão API

```bash
npm run dev
# Logs deve mostrar:
# ✅ API connection OK
# ✅ Database connection OK
# ✅ Webhooks detected: [15802]
```

### Teste 2: Validar Projeto Teste

```bash
# Usar projeto existente (ex: 26-00140-SWG)
curl -X GET http://localhost:3000/api/projects/2297131
```

### Teste 3: Simular Cascata (DRY-RUN)

```bash
DRY_RUN=true npm run dev

# Sistema deve:
# 1. Monitorar webhook de projeto novo
# 2. Simular criação de tasks fase 1
# 3. Logar cada simulação
# ❌ NÃO fazer ações reais
```

### Teste 4: Validar Logs

```bash
npm run audit:logs
# Mostrar últimas 100 ações + filtros
```

### Teste 5: Validar Isolamento

```bash
npm run audit:conflicts
# Mostrar se houve conflitos com Zapier
```

### ✅ Staging OK Quando:

- [ ] Teste 24h+ sem erros
- [ ] Validações passando 100%
- [ ] Logs capturando tudo
- [ ] Zapier não foi disparado acidentalmente
- [ ] Alertas funcionando
- [ ] Equipe entende logs

---

## Modo Produção

### ⚠️ PRÉ-REQUISITOS

**Antes de ativar em produção:**

- [ ] Staging validado 24h+
- [ ] Todas validações passando
- [ ] Backup do banco de dados
- [ ] Plano de rollback testado
- [ ] Alertas configurados (Slack + Email)
- [ ] Documentação lida pela equipe
- [ ] Chave de API validada
- [ ] Webhooks configurados corretamente

### 1. Preparar Novo Projeto Teste

```bash
# Criar projeto em Albiware:
# Nome: 26-99999-PROD-TEST (Sewage ou Water)
# Status: New
# Manager: Seu nome

export PROJECT_ID=999999
```

### 2. Ligar DRY_RUN=false

```env
NODE_ENV=production
DRY_RUN=false
VALIDATE_ALL_ACTIONS=true
LOG_ALL_REQUESTS=true
ISOLATION_MODE=strict
```

### 3. Deploy com Docker

```bash
# Build
docker build -t albiware-automation:v1.0.0 .

# Run
docker run -d \
  --name albiware-automation \
  --env-file .env \
  -p 3000:3000 \
  albiware-automation:v1.0.0
```

### 4. Monitorar Primeira Execução

```bash
# Logs em tempo real
docker logs -f albiware-automation

# Deve criar:
# - 6 tasks fase 1 ✅
# - Nenhum erro ✅
# - Zapier disparado (esperado) ✅
```

### 5. Validar Tudo

```bash
# Confirmar tasks criadas
curl http://localhost:3000/api/projects/999999/tasks
# Deve listar 6 tasks da fase 1

# Confirmar audit log
npm run audit:logs
# Todas ações devem estar registradas

# Confirmar alertas
# Slack deve ter recebido notificação de sucesso
```

---

## Documentação Técnica

### Arquitetura

```
src/
├── types/              # Tipos TypeScript compartilhados
├── config/             # Configuração + validação
├── utils/
│   └── logger.ts       # Logger estruturado (Pino)
├── services/
│   ├── albiware.client.ts      # Cliente HTTP com retry
│   ├── validation.service.ts   # Validações de segurança
│   ├── cascade.service.ts      # Lógica da cascata
│   └── audit.service.ts        # Audit trail
├── db/
│   ├── migrate.ts      # Migration de banco
│   └── models/         # Models de dados
├── webhooks/
│   └── handler.ts      # Webhook receiver
└── index.ts            # Entry point
```

### API Endpoints

#### GET /health
Status da aplicação.

```bash
curl http://localhost:3000/health
```

#### GET /api/projects/:projectId
Detalhes do projeto.

```bash
curl http://localhost:3000/api/projects/2297131
```

#### POST /api/trigger
Disparar automação manualmente.

```bash
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -d '{"projectId": 2297131}'
```

#### GET /api/audit/logs
Logs de auditoria.

```bash
curl "http://localhost:3000/api/audit/logs?limit=50&action=CREATE_TASK"
```

---

## Troubleshooting

### ❌ Erro: "Api Key was not provided"

**Causa:** Chave de API inválida ou formato errado

**Solução:**
```bash
# 1. Verificar em Albiware Settings > Integrations
# 2. Copiar chave corretamente
# 3. Adicionar ao .env
# 4. Reiniciar aplicação

npm run dev
```

### ❌ Erro: "Database connection failed"

**Causa:** PostgreSQL não está rodando ou credenciais erradas

**Solução:**
```bash
# 1. Verificar PostgreSQL
psql -h localhost -U postgres -d postgres

# 2. Verificar .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=automation
DB_PASSWORD=***

# 3. Criar database se não existe
createdb albiware_automation -U automation

# 4. Rodar migrations
npm run db:migrate
```

### ❌ Erro: "Task already exists"

**Causa:** Tarefa foi criada mas validação não detectou (ou foi criada 2x)

**Solução:**
```bash
# 1. Verificar em Albiware se task existe mesmo
# 2. Se existe: OK, sistema pulará corretamente
# 3. Se erro é frequente: aumentar timeout
#    API_TIMEOUT_MS=60000 (no .env)
```

### ❌ Zapier foi disparado quando não deveria

**Causa:** Atualização de data disparou webhook de Zapier

**Solução:**
```bash
# 1. Pausar automação imediatamente
npm run stop:emergency

# 2. Verificar logs
npm run audit:conflicts

# 3. Se necessário, rollback das ações
npm run rollback:last

# 4. Investigar por quê Zapier reagiu
# 5. Ajustar webhook conflict action
WEBHOOK_CONFLICT_ACTION=pause_automation
```

### ⚡ Performance: Automação Lenta

**Causa:** Rate limiting ou muitas validações

**Solução:**
```env
# Aumentar limits
MAX_REQUESTS_PER_SECOND=20
MAX_TASKS_PER_HOUR=200

# Reduzir logging
LOG_ALL_REQUESTS=false

# Cache de validações
VALIDATE_ALL_ACTIONS=true (já cacheia)
```

---

## Emergência

### 🚨 Algo Deu Terrivelmente Errado

**Passo 1: PARAR IMEDIATAMENTE**

```bash
npm run stop:emergency

# Ou matador pela força:
pkill -f "albiware-automation"
docker stop albiware-automation
```

**Passo 2: VERIFICAR DANOS**

```bash
npm run audit:logs
# Último 1 hora de ações

npm run audit:conflicts
# Havia conflitos?

# No banco:
SELECT * FROM audit_logs 
WHERE timestamp > now() - interval '1 hour'
ORDER BY timestamp DESC;
```

**Passo 3: ROLLBACK (se necessário)**

```bash
# Voltar última 1 hora de ações
npm run rollback:last

# Voltar tudo do dia
npm run rollback:day

# Restaurar backup
psql albiware_automation < backup_$(date +%Y%m%d).sql
```

**Passo 4: INVESTIGAÇÃO**

```bash
# Analisar logs
npm run audit:logs --format json > /tmp/audit.json

# Verificar em Albiware se tasks ficaram duplicadas
# Validar datas

# Contactar Slack: "Automação foi pausada por erro. Investigar..."
```

**Passo 5: RESUMIR (quando seguro)**

```bash
# Após corrigir problema
npm run resume

# Validar tudo
npm run safe-test

# Restart normal
npm run dev
```

---

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Rodar em modo desenvolvimento
npm run watch            # Watchmode + rebuild
npm run build            # Build TypeScript

# Teste Seguro
npm run dry-run          # Modo DRY_RUN=true
npm run safe-test        # Teste seguro em staging

# Banco de Dados
npm run db:migrate       # Rodar migrations
npm run db:seed          # Popular dados teste
npm run db:rollback      # Reverter migrations

# Auditoria
npm run audit:logs       # Ver logs de auditoria
npm run audit:conflicts  # Verificar conflitos com webhooks

# Emergência
npm run stop:emergency   # Parar e fazer snapshot
npm run rollback:last    # Reverter últimas ações
npm run rollback:day     # Reverter último dia

# Testes
npm run test             # Rodar testes
npm run test:watch       # Modo watch
npm run test:coverage    # Cobertura

# Lint
npm run lint             # ESLint
npm run format           # Prettier
```

---

## Suporte

### Documentação Adicional

- `./docs/ARCHITECTURE.md` - Arquitetura detalhada
- `./docs/API.md` - API endpoints
- `./docs/DEPLOYMENT.md` - Deploy guia
- `./docs/MONITORING.md` - Monitoramento
- `./docs/TROUBLESHOOTING.md` - Troubleshooting completo

### Contato

- **DevOps:** albiware-automation@quickresponse.com
- **Slack:** #albiware-automation
- **Emergência:** /alert-automation-team

---

## License

PROPRIETARY - Uso exclusivo Quick Response Restoration, Inc.

---

**Última Atualização:** 2026-08-23  
**Versão:** 1.0.0  
**Status:** ✅ Pronto para Staging Testing
