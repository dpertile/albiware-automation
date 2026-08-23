#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🧪 ALBIWARE AUTOMATION - AUTOMATED TEST SCRIPT
#
# Uso: ./test-automation.sh PROJECT_ID
# Exemplo: ./test-automation.sh 2297131
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# FUNÇÕES AUXILIARES
# ═══════════════════════════════════════════════════════════════════════════

print_header() {
  echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC} $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════
# VALIDAÇÕES PRÉ-TESTE
# ═══════════════════════════════════════════════════════════════════════════

validate_project_id() {
  if [ -z "$1" ]; then
    print_error "PROJECT_ID não fornecido"
    echo "Uso: ./test-automation.sh PROJECT_ID"
    echo "Exemplo: ./test-automation.sh 2297131"
    exit 1
  fi

  if ! [[ "$1" =~ ^[0-9]+$ ]]; then
    print_error "PROJECT_ID deve ser um número"
    exit 1
  fi

  print_success "PROJECT_ID válido: $1"
}

check_docker() {
  if ! command -v docker &> /dev/null; then
    print_error "Docker não está instalado"
    exit 1
  fi

  if ! docker ps &> /dev/null; then
    print_error "Docker daemon não está rodando"
    exit 1
  fi

  print_success "Docker está rodando"
}

check_server() {
  print_info "Aguardando servidor responder..."
  
  for i in {1..30}; do
    if curl -s http://localhost:3000/health &> /dev/null; then
      print_success "Servidor respondendo"
      return 0
    fi
    echo -n "."
    sleep 1
  done

  print_error "Servidor não respondeu após 30s"
  echo "Tente: docker-compose up -d"
  exit 1
}

check_dry_run() {
  print_info "Verificando modo DRY_RUN..."

  DRY_RUN=$(curl -s http://localhost:3000/health | grep -o '"dryRun":[^,}]*' | grep -o 'true\|false')

  if [ "$DRY_RUN" != "true" ]; then
    print_error "DRY_RUN está desativado (=false)"
    print_warning "TESTE PODE CRIAR TAREFAS REAIS!"
    read -p "Deseja continuar? (s/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
      print_info "Teste cancelado"
      exit 0
    fi
  else
    print_success "DRY_RUN=true (seguro)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# VALIDAÇÃO DE PROJETO
# ═══════════════════════════════════════════════════════════════════════════

validate_project() {
  local PROJECT_ID=$1
  print_info "Validando projeto $PROJECT_ID..."

  PROJECT_DATA=$(curl -s "http://localhost:3000/api/projects/$PROJECT_ID")

  # Verificar se projeto existe
  if echo "$PROJECT_DATA" | grep -q '"error"'; then
    print_error "Projeto $PROJECT_ID não encontrado"
    exit 1
  fi

  # Extrair informações
  PROJECT_NAME=$(echo "$PROJECT_DATA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
  PROJECT_TYPE=$(echo "$PROJECT_DATA" | grep -o '"projectType":"[^"]*' | cut -d'"' -f4)
  PROJECT_STATUS=$(echo "$PROJECT_DATA" | grep -o '"status":"[^"]*' | cut -d'"' -f4)

  print_success "Projeto encontrado: $PROJECT_NAME"
  print_info "Tipo: $PROJECT_TYPE"
  print_info "Status: $PROJECT_STATUS"

  # Validar tipo
  case $PROJECT_TYPE in
    Water|Sewage|Mold|Biohazard|"Emergency Services"|"Structural Cleaning")
      print_success "Tipo de projeto aplicável"
      ;;
    *)
      print_error "Tipo de projeto não suportado: $PROJECT_TYPE"
      exit 1
      ;;
  esac

  # Validar status
  if [ "$PROJECT_STATUS" != "New" ]; then
    print_warning "Status não é 'New' (é: $PROJECT_STATUS)"
    print_warning "Pode haver tarefas pré-existentes"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# DISPARAR CASCATA
# ═══════════════════════════════════════════════════════════════════════════

trigger_cascade() {
  local PROJECT_ID=$1
  
  print_header "🚀 Disparando Cascata"

  START_TIME=$(date +%s)

  RESULT=$(curl -s -X POST http://localhost:3000/api/trigger \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": $PROJECT_ID}")

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  # Verificar sucesso
  if echo "$RESULT" | grep -q '"success":true'; then
    print_success "Cascata disparada com sucesso"
    print_info "Duração: ${DURATION}s"

    # Extrair operationId
    OPERATION_ID=$(echo "$RESULT" | grep -o '"operationId":"[^"]*' | cut -d'"' -f4)
    print_info "Operation ID: $OPERATION_ID"

    return 0
  else
    print_error "Falha ao disparar cascata"
    echo "$RESULT" | jq .
    exit 1
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# VALIDAR LOGS
# ═══════════════════════════════════════════════════════════════════════════

validate_logs() {
  local PROJECT_ID=$1

  print_header "📊 Validando Logs de Auditoria"

  # Aguardar logs processarem
  sleep 2

  # Obter logs
  LOGS=$(curl -s "http://localhost:3000/api/audit/logs?projectId=$PROJECT_ID&limit=50")

  # Contar ações
  TOTAL_ACTIONS=$(echo "$LOGS" | jq '.data | length')
  SUCCESS_ACTIONS=$(echo "$LOGS" | jq '[.data[] | select(.success==true)] | length')
  FAILED_ACTIONS=$(echo "$LOGS" | jq '[.data[] | select(.success==false)] | length')

  print_info "Total de ações: $TOTAL_ACTIONS"
  print_info "Ações bem-sucedidas: $SUCCESS_ACTIONS"
  print_info "Ações falhadas: $FAILED_ACTIONS"

  # Contar por tipo
  CREATE_TASK=$(echo "$LOGS" | jq '[.data[] | select(.action=="CREATE_TASK")] | length')
  print_info "Tasks criadas: $CREATE_TASK"

  # Validar
  if [ "$FAILED_ACTIONS" -gt 0 ]; then
    print_error "Há $FAILED_ACTIONS ações falhadas!"
    echo "$LOGS" | jq '.data[] | select(.success==false)'
    return 1
  fi

  if [ "$CREATE_TASK" -lt 6 ]; then
    print_warning "Esperava 6 tasks criadas (fase 1), got: $CREATE_TASK"
  else
    print_success "6 tasks criadas (Fase 1)"
  fi

  return 0
}

# ═══════════════════════════════════════════════════════════════════════════
# VALIDAR ISOLAMENTO
# ═══════════════════════════════════════════════════════════════════════════

validate_isolation() {
  print_header "🔒 Validando Isolamento"

  # Verificar conflitos
  CONFLICTS=$(curl -s "http://localhost:3000/api/conflicts" | jq '.data | length')
  
  if [ "$CONFLICTS" -eq 0 ]; then
    print_success "Nenhum conflito detectado"
  else
    print_warning "$CONFLICTS conflitos detectados"
    curl -s "http://localhost:3000/api/conflicts" | jq '.data[]'
  fi

  # Verificar safety report
  SAFETY=$(curl -s http://localhost:3000/api/safety-report)
  
  SAFE_MODE=$(echo "$SAFETY" | jq -r '.safeModeEnabled')
  DELETE_PROTECT=$(echo "$SAFETY" | jq -r '.autoDeleteProtection')
  WHITELIST=$(echo "$SAFETY" | jq -r '.whitelistEnabled')

  if [ "$SAFE_MODE" = "true" ] && [ "$DELETE_PROTECT" = "true" ] && [ "$WHITELIST" = "true" ]; then
    print_success "Todas proteções ativas"
  else
    print_warning "Algumas proteções desativadas"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# VALIDAR ALBIWARE
# ═══════════════════════════════════════════════════════════════════════════

validate_albiware() {
  local PROJECT_ID=$1

  print_header "🔍 Verificando Albiware UI"

  print_info "URL: https://app.albiware.com/Project/$PROJECT_ID"

  if [ "$DRY_RUN" = "true" ]; then
    print_info "Modo DRY_RUN ativo - NENHUMA tarefa deve estar criada em Albiware"
    print_warning "Verifique manualmente em Albiware que:"
    echo "  - Nenhuma tarefa foi criada"
    echo "  - Nenhuma data foi modificada"
    echo "  - Status não mudou"
  else
    print_warning "DRY_RUN desativado - Tasks podem ter sido criadas!"
    print_info "Verifique em Albiware que:"
    echo "  - 6 tarefas foram criadas (Fase 1)"
    echo "  - Todas têm tag [AUTOMATED-CASCADE]"
    echo "  - Nenhuma tarefa de outro sistema foi afetada"
  fi

  read -p "Pressione ENTER quando tiver verificado..."
}

# ═══════════════════════════════════════════════════════════════════════════
# ESTATÍSTICAS
# ═══════════════════════════════════════════════════════════════════════════

show_stats() {
  print_header "📈 Estatísticas"

  STATS=$(curl -s "http://localhost:3000/api/stats?hours=1")

  TOTAL=$(echo "$STATS" | jq '.totalActions')
  SUCCESSFUL=$(echo "$STATS" | jq '.successfulActions')
  FAILED=$(echo "$STATS" | jq '.failedActions')
  ERROR_RATE=$(echo "$STATS" | jq '.errorRate')

  echo "Total de ações: $TOTAL"
  echo "Bem-sucedidas: $SUCCESSFUL"
  echo "Falhadas: $FAILED"
  echo "Taxa de erro: ${ERROR_RATE}%"

  # Validar
  if [ "$(echo "$ERROR_RATE > 0" | bc)" -eq 1 ]; then
    print_error "Taxa de erro > 0%"
    return 1
  else
    print_success "Taxa de erro = 0%"
    return 0
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# SALVAR RELATÓRIO
# ═══════════════════════════════════════════════════════════════════════════

save_report() {
  local PROJECT_ID=$1
  
  print_header "📋 Salvando Relatório"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  REPORT_FILE="/tmp/test_report_${PROJECT_ID}_${TIMESTAMP}.json"

  # Coletar dados
  {
    echo "{"
    echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"projectId\": $PROJECT_ID,"
    echo "  \"environment\": \"staging\","
    echo "  \"dryRun\": $DRY_RUN,"
    echo "  \"logs\": $(curl -s "http://localhost:3000/api/audit/logs?projectId=$PROJECT_ID&limit=100"),"
    echo "  \"stats\": $(curl -s "http://localhost:3000/api/stats?hours=1"),"
    echo "  \"conflicts\": $(curl -s "http://localhost:3000/api/conflicts"),"
    echo "  \"safety\": $(curl -s "http://localhost:3000/api/safety-report")"
    echo "}"
  } > "$REPORT_FILE"

  print_success "Relatório salvo em: $REPORT_FILE"
  print_info "Tamanho: $(ls -lh $REPORT_FILE | awk '{print $5}')"
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

main() {
  print_header "🧪 ALBIWARE AUTOMATION - TESTE AUTOMATIZADO"

  # Validações pré-teste
  validate_project_id "$1"
  PROJECT_ID=$1

  check_docker
  check_server
  check_dry_run

  # Validações de projeto
  validate_project "$PROJECT_ID"

  # Disparar cascata
  trigger_cascade "$PROJECT_ID"

  # Validações pós-teste
  validate_logs "$PROJECT_ID" || {
    print_error "Validação de logs falhou"
    exit 1
  }

  validate_isolation

  show_stats || {
    print_warning "Stats com problemas"
  }

  # Validar Albiware
  validate_albiware "$PROJECT_ID"

  # Salvar relatório
  save_report "$PROJECT_ID"

  # Resumo final
  print_header "✅ TESTE CONCLUÍDO COM SUCESSO"
  
  echo "Próximos passos:"
  echo "1. Revisar relatório:"
  echo "   cat $(ls -t /tmp/test_report_${PROJECT_ID}_*.json | head -1)"
  echo ""
  echo "2. Se tudo OK, passar para produção:"
  echo "   sed -i 's/DRY_RUN=true/DRY_RUN=false/' .env"
  echo "   docker-compose restart"
  echo ""
  echo "3. Monitorar logs:"
  echo "   docker-compose logs -f automation"
}

# ═══════════════════════════════════════════════════════════════════════════

main "$@"
