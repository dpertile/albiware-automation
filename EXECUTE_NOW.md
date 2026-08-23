# 🎯 GUIA EXECUTIVO - TESTE COM SEU PROJETO REAL

**Projeto:** 26-00141-WTR  
**PROJECT_ID:** 2297140  
**Status:** Pronto para Teste  
**Data:** 2026-08-23

---

## 📋 Resumo Executivo

Você tem um sistema **100% pronto para testar**. Precisa apenas:

1. Iniciar o servidor (1 comando)
2. Rodar o teste (1 comando)
3. Revisar resultado (2 minutos)

**Tempo total:** ~15 minutos

---

## 🚀 PASSO-A-PASSO EXECUTIVO

### PASSO 1: Preparar Ambiente (5 minutos)

```bash
# Ir para pasta do projeto
cd /home/claude/albiware-automation

# Instalar dependências (apenas primeira vez)
npm install

# Copiar configuração
cp .env.example .env

# Editar .env (verificar API Key)
nano .env
```

**Checklist .env:**
```
NODE_ENV=staging         ✅
DRY_RUN=true             ✅ (IMPORTANTE - teste seguro)
ALBIWARE_API_KEY=304... ✅ (já tem)
DB_HOST=localhost        ✅
DB_PORT=5432             ✅
```

---

### PASSO 2: Iniciar Servidor (2 minutos)

**Opção A: Com Docker (Recomendado)**

```bash
# Iniciar tudo
docker-compose up -d

# Aguardar inicialização
sleep 30

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs automation --tail=20
```

**Opção B: Sem Docker (Node.js direto)

```bash
# Build
npm run build

# Iniciar
npm start

# Esperado:
# ✅ Servidor iniciado
# ✅ URL: http://localhost:3000/health
```

---

### PASSO 3: Validar Servidor (1 minuto)

```bash
# Health check
curl http://localhost:3000/health | jq

# Esperado:
# {
#   "status": "healthy",
#   "dryRun": true,
#   "environment": "staging"
# }
```

---

### PASSO 4: Executar Teste (3 minutos)

Em um **novo terminal**:

```bash
cd /home/claude/albiware-automation

# Rodar teste automatizado
chmod +x test-automation.sh
./test-automation.sh 2297140
```

**O script vai:**
1. ✅ Validar projeto (26-00141-WTR)
2. ✅ Disparar cascata
3. ✅ Coletar 6 tasks criadas
4. ✅ Validar logs
5. ✅ Validar isolamento
6. ✅ Gerar relatório

**Tempo esperado:** 2-3 minutos

---

### PASSO 5: Revisar Resultado (2 minutos)

**Procure por estas linhas no output:**

```
✅ Cascata disparada com sucesso
✅ 6 tasks criadas (Fase 1)
✅ Nenhum conflito detectado
✅ Todas proteções ativas
✅ Taxa de erro = 0%
```

**Se tudo passar:** 🎉 Sistema funciona!

**Se algo falhar:** Ver logs
```bash
docker-compose logs automation | grep -i error
```

---

### PASSO 6: Verificar em Albiware (2 minutos)

1. Ir para: https://app.albiware.com/Project/2297140
2. Aba "Tasks"

**Esperado em DRY-RUN:**
```
❌ NENHUMA tarefa criada (é simulado!)
❌ Nenhuma data modificada
❌ Status não mudou
```

Se há tarefas criadas, significa `DRY_RUN=false` (erro!)

---

## 📊 Checklist de Teste

**Antes de Começar:**
- [ ] Node.js instalado (`node --version`)
- [ ] npm instalado (`npm --version`)
- [ ] Docker instalado (opcional, `docker --version`)
- [ ] PostgreSQL disponível (ou usar Docker)
- [ ] PROJECT_ID anotado (2297140)

**Durante Teste:**
- [ ] Servidor iniciado (`http://localhost:3000/health`)
- [ ] Teste executado (`./test-automation.sh 2297140`)
- [ ] Resultado satisfatório (tudo ✅)

**Após Teste:**
- [ ] Verificado em Albiware UI (nenhuma tarefa)
- [ ] Relatório salvo (`/tmp/test_report_*.json`)
- [ ] Logs revisados

---

## ✅ Resultado Esperado

### Sucesso (✅)
```
╔════════════════════════════════════════╗
║      ✅ TESTE CONCLUÍDO COM SUCESSO   ║
╚════════════════════════════════════════╝

Cascata disparada em projeto 2297140
6 tasks criadas (Fase 1)
0 erros, 0 conflitos
Taxa de erro: 0%
Todas proteções ativas
```

### Falha (❌)
```
Ver logs:
docker-compose logs automation | grep error

Ver erros de auditoria:
curl "http://localhost:3000/api/audit/logs?errors=true" | jq
```

---

## 🔍 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| "Port 3000 already in use" | `lsof -i :3000` e matar processo |
| "Docker daemon not running" | `sudo systemctl start docker` |
| "npm ERR" | `rm -rf node_modules && npm install` |
| "DRY_RUN=false" | `sed -i 's/DRY_RUN=false/DRY_RUN=true/' .env` |
| "Servidor não responde" | `docker-compose logs automation` |

---

## 📈 Próximas Ações (Após Teste OK)

### Se Teste Passou ✅

**Opção 1: Testar Mais Projetos**
- Criar 2-3 novos projetos de teste
- Executar teste em cada um
- Validar consistência

**Opção 2: Validar 24h**
- Deixar rodando por 24 horas
- Monitorar logs
- Validar sem erros

**Opção 3: Ir Para Produção**
```bash
# Após 24h+ de teste:

# 1. Backup
docker-compose exec postgres pg_dump -U automation \
  albiware_automation > backup_pre_prod.sql

# 2. Mudar para produção
sed -i 's/DRY_RUN=true/DRY_RUN=false/' .env
sed -i 's/NODE_ENV=staging/NODE_ENV=production/' .env

# 3. Restart
docker-compose restart automation

# 4. Testar com novo projeto
./test-automation.sh NOVO_PROJECT_ID
```

---

## 📁 Arquivos Importantes

```
/home/claude/albiware-automation/

├── test-automation.sh          ← Script que você vai rodar
├── QUICK_START.md              ← Guia rápido
├── README.md                   ← Documentação completa
│
├── src/
│   ├── index.ts                ← Servidor Express
│   └── services/
│       ├── cascade.service.ts  ← Motor de cascata
│       └── task-ownership.service.ts ← Proteção
│
├── docs/
│   ├── TESTING.md              ← Guia de teste
│   ├── ISOLATION.md            ← Isolamento (proteção)
│   └── ARCHITECTURE.md         ← Design técnico
│
├── .env.example                ← Template (copiar para .env)
├── docker-compose.yml          ← Docker setup
└── package.json                ← NPM dependencies
```

---

## 🎓 Resumo para não se perder

```
1. npm install                    (setup)
2. docker-compose up -d           (iniciar servidor)
3. sleep 30                       (aguardar)
4. ./test-automation.sh 2297140   (rodar teste)
5. Aguardar 2-3 minutos           (teste executa)
6. Revisar resultado              (deve ter ✅)
7. Verificar em Albiware          (nenhuma tarefa)
```

**Tempo total:** ~15 minutos

---

## ❓ Perguntas Frequentes

**P: E se der erro no meio do teste?**
R: Script pausa e mostra erro. Ver logs com:
```bash
docker-compose logs automation | tail -50
```

**P: Posso testar com outro projeto?**
R: Sim! Use outro PROJECT_ID:
```bash
./test-automation.sh OUTRO_ID
```

**P: Como faço rollback se algo deu errado?**
R: Script de emergência:
```bash
npm run stop:emergency    # Pausa
npm run rollback:last 1   # Reverter 1h
```

**P: Posso ir direto para produção?**
R: Não recomendado. Faça:
1. Testar em staging (DRY_RUN=true) por 24h+
2. Validar múltiplos projetos
3. Depois mudar para DRY_RUN=false

**P: Quantas tarefas vão ser criadas?**
R: Em DRY-RUN: 0 (é simulado)
Em produção: 6 na fase 1 (depois 8 na fase 2, depois 7 na fase 3)

---

## 🚀 Próximo Passo

**Quando tiver executado o teste com sucesso, me avisa:**

```
✅ Teste concluído
✅ Cascata disparada
✅ 6 tasks criadas
✅ Nenhum erro
✅ Isolamento OK
```

Aí podemos:
1. Testar em mais projetos
2. Validar 24h
3. Deploy em produção

---

**Status:** ✅ Pronto para Executar  
**Projeto:** 26-00141-WTR (2297140)  
**Modo:** DRY-RUN (seguro)  
**Próxima Ação:** Você executa o teste!

```bash
./test-automation.sh 2297140
```

---

**Boa sorte! 🚀**
