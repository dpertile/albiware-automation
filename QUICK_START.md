# 🚀 QUICK START - TESTE EM PROJETO REAL

**Tempo total:** ~10 minutos (tudo automatizado)

---

## 📌 PASSO 1: OBTER PROJECT_ID

Qual é o PROJECT_ID do trabalho que você vai usar?

**Opções:**
- Criar novo projeto em Albiware (Type: Water ou Sewage, Status: New)
- Usar projeto existente (se status = "New" e sem tarefas)

**Anote aqui:**
```
PROJECT_ID = _________________
```

---

## 🎯 PASSO 2: EXECUTAR TESTE AUTOMATIZADO

### 2.1 Preparar

```bash
cd /home/claude/albiware-automation
chmod +x test-automation.sh
```

### 2.2 Executar (substitua XXXXX pelo seu PROJECT_ID)

```bash
./test-automation.sh XXXXX
```

**Exemplo:**
```bash
./test-automation.sh 2297131
```

### 2.3 Acompanhar

O script vai:
1. ✅ Validar ambiente
2. ✅ Verificar servidor rodando
3. ✅ Validar projeto (tipo, status)
4. ✅ Disparar cascata (DRY-RUN)
5. ✅ Coletar logs
6. ✅ Validar isolamento
7. ✅ Mostrar stats
8. ✅ Salvar relatório

**Esperado:** Deve levar ~2-3 minutos

---

## 📊 PASSO 3: REVISAR RESULTADOS

### 3.1 Ver Saída do Script

Procure por:
```
✅ Cascata disparada com sucesso
✅ 6 tasks criadas (Fase 1)
✅ Nenhum conflito detectado
✅ Todas proteções ativas
✅ Taxa de erro = 0%
```

### 3.2 Ver Relatório Completo

```bash
# Ver arquivo gerado
ls -lh /tmp/test_report_*.json

# Visualizar (substituir XXXXX pelo seu PROJECT_ID)
jq . /tmp/test_report_XXXXX_*.json | head -100
```

### 3.3 Verificar Em Albiware

1. Ir para: https://app.albiware.com/Project/XXXXX
2. Aba "Tasks"
3. **Esperado em DRY-RUN:**
   - ❌ Nenhuma tarefa criada (é simulado!)
   - ✅ Projeto sem mudanças

---

## ⚠️ TROUBLESHOOTING RÁPIDO

### "Docker daemon not running"
```bash
docker-compose up -d
sleep 30
./test-automation.sh XXXXX
```

### "Servidor não respondendo"
```bash
# Ver logs
docker-compose logs automation --tail=50

# Restart
docker-compose restart automation
sleep 5
./test-automation.sh XXXXX
```

### "Project not found"
```bash
# Verificar ID
curl http://localhost:3000/api/projects/XXXXX | jq .data.id

# Deve retornar um número
```

### "DRY_RUN is false"
```bash
# Verificar
grep DRY_RUN /home/claude/albiware-automation/.env

# Deve ser: DRY_RUN=true

# Se não for:
sed -i 's/DRY_RUN=false/DRY_RUN=true/' /home/claude/albiware-automation/.env
docker-compose restart automation
```

---

## ✅ APÓS TESTE PASSAR

Se o teste passou (tudo verde), você tem 2 opções:

### Opção A: Testar Mais Um Pouco (Recomendado)

```bash
# Testar em outro projeto para validar
./test-automation.sh YYYYY  # Novo PROJECT_ID
```

Repetir 2-3x com projetos diferentes para ganhar confiança.

### Opção B: Ir Para Produção (Após 24h de teste)

```bash
# APENAS após validar 24h:

# 1. Backup banco
docker-compose exec postgres pg_dump -U automation albiware_automation \
  > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Mudar para produção
sed -i 's/DRY_RUN=true/DRY_RUN=false/' /home/claude/albiware-automation/.env
sed -i 's/NODE_ENV=staging/NODE_ENV=production/' /home/claude/albiware-automation/.env

# 3. Restart
docker-compose restart automation
sleep 10

# 4. Testar em novo projeto
./test-automation.sh ZZZZZ  # Novo PROJECT_ID para produção
```

---

## 📋 CHECKLIST FINAL

Antes de considerar OK:

- [ ] Script executado sem erros
- [ ] ✅ Cascata disparada
- [ ] ✅ 6 tasks criadas em logs
- [ ] ✅ 0% taxa de erro
- [ ] ✅ 0 conflitos
- [ ] ✅ Todas proteções ativas
- [ ] ❌ Nenhuma tarefa em Albiware (DRY-RUN)
- [ ] Relatório salvo em `/tmp/test_report_*.json`

---

## 🎯 PRÓXIMAS AÇÕES

**Se tudo passou:**
1. ✅ Teste passou
2. → Repetir teste 2-3x com outros projetos
3. → Validar 24h sem erros
4. → Mudar para produção
5. → Deploy final

**Se algo falhou:**
1. Ver logs completos: `docker-compose logs automation`
2. Ver erros: `curl http://localhost:3000/api/audit/logs?errors=true`
3. Parar: `npm run stop:emergency`
4. Consertar problema
5. Testar novamente

---

## 📞 PRECISAR DE AJUDA?

```bash
# Ver documentação completa
cat /home/claude/albiware-automation/docs/TESTING.md

# Ver logs em tempo real
docker-compose logs -f automation

# Ver stats
curl http://localhost:3000/api/stats | jq

# Ver logs de auditoria (último projeto)
curl "http://localhost:3000/api/audit/logs?limit=20" | jq
```

---

## 🎉 RESUMO

```
┌─────────────────────────────────────────┐
│  🧪 TESTE EM PROJETO REAL              │
├─────────────────────────────────────────┤
│                                         │
│  1. ./test-automation.sh PROJECT_ID    │
│                                         │
│  2. Aguarde 2-3 minutos                │
│                                         │
│  3. Revise resultado                   │
│                                         │
│  4. Se ✅ - Teste passou!             │
│     Se ❌ - Ver logs                   │
│                                         │
│  5. Repetir 2-3x com novos projetos   │
│                                         │
│  6. Ir para produção                   │
│                                         │
└─────────────────────────────────────────┘
```

---

**Vamos começar? Qual é seu PROJECT_ID?** 🚀

Quando tiver, execute:
```bash
cd /home/claude/albiware-automation
./test-automation.sh SEU_PROJECT_ID
```

Me avisa o resultado! ✅
