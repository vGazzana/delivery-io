# ADR 001: Arquitetura do Sistema de Gestão para Lancheria

**Status:** Proposta  
**Data:** 15 de Outubro de 2025  
**Contexto:** Projeto acadêmico  
**Decisores:** [Seu Nome]

---

## Contexto e Problema

Desenvolver uma aplicação administrativa **multi-tenant** para gerenciar operações de lancherias, permitindo que múltiplas empresas usem o mesmo sistema de forma isolada. Cada lancheria (tenant) terá:

- Gestão de clientes, estoque e vendas
- Controle de entregas com rastreamento de motoboys
- Sistema de pagamento de funcionários
- Dashboard analítico em tempo real
- Integração com WhatsApp para notificações

**Desafios principais:**
1. **Isolamento de dados entre tenants** (segurança crítica)
2. Coordenação de entregas em lote (múltiplas entregas por motoboy)
3. Comunicação real-time entre sistema e motoboys
4. Sincronização de dados entre módulos
5. Escalabilidade horizontal (adicionar novos tenants sem redeployer)

---

## Decisões Arquiteturais

### 1. Estrutura do Projeto: Monorepo

**Decisão:** Monorepo com `pnpm workspaces`

**Justificativa:**
- Compartilhamento de tipos TypeScript entre frontend e backend
- Versionamento unificado
- Deploy simplificado
- Reutilização de código (validações, DTOs)

**Estrutura:**
```
lancheria-admin/
├── packages/
│   ├── app/          # Next.js frontend
│   ├── server/       # Fastify backend
│   └── shared/       # Tipos, utils, validações
├── docker-compose.yml
└── pnpm-workspace.yaml
```

---

### 2. Frontend: Next.js com shadcn/ui

**Stack:**
- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **Estado:** React Query + Zustand
- **Formulários:** React Hook Form + Zod
- **Mapas:** Leaflet (OSM gratuito)
- **Autenticação:** JWT com role-based views (Admin/Motoboy)

**Justificativa:**
- **Next.js oferece SSR** para SEO e melhor UX
- **shadcn/ui** acelera desenvolvimento com componentes prontos
- **React Query** simplifica cache e sincronização
- **Leaflet** é gratuito e suficiente para o escopo
- **Mesma aplicação para ambos perfis:** Reduz complexidade, reutiliza código
  - Login diferenciado: Toggle "Entrar como Motoboy" na tela de login
  - Rotas protegidas por role (middleware Next.js)
  - Views condicionais: Admin vê dashboard completo, Motoboy vê apenas seus lotes

**Alternativas consideradas:**
- ❌ Apps separados (Admin + Motoboy): Duplicação de código, manutenção duplicada
- ❌ Vite + React: Menos features prontas (roteamento, SSR)
- ❌ Vue/Nuxt: Menor ecossistema de componentes admin

---

### 3. Backend: Arquitetura Modular em Camadas

**Decisão:** Modular Monolith ao invés de microserviços/serverless

**Stack:**
- **Framework:** Fastify 4.x
- **ORM:** Drizzle ORM
- **Banco de dados:** PostgreSQL 15
- **Cache/PubSub:** Redis 7
- **Real-time:** Socket.io
- **Validação:** Zod
- **Documentação:** Swagger/OpenAPI
- **Notificações:** Evolution API (WhatsApp)

**Estrutura de Camadas:**
```
server/src/
├── modules/
│   ├── customers/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── routes.ts
│   ├── inventory/
│   ├── sales/
│   ├── delivery/        # Pub/Sub de entregas aqui
│   ├── employees/
│   └── analytics/
├── shared/
│   ├── infrastructure/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── queue.ts
│   │   └── websocket.ts
│   ├── middlewares/
│   └── utils/
└── server.ts            # Gateway/Router principal
```

**Justificativa:**
- **Modular Monolith** oferece separação lógica sem complexidade de microserviços
- **Fastify** tem performance superior ao Express (até 2x)
- **Drizzle ORM** é type-safe e gera SQL eficiente
- **Redis** resolve pub/sub E cache simultaneamente
- **Socket.io** para comunicação bidirecional (rastreamento GPS)
- **Sem filas de processamento:** Criação de lotes é manual, não precisa BullMQ
- **Middleware de tenant:** Injeta `tenant_id` em todas as queries automaticamente

**Isolamento Multi-Tenant:**
```typescript
// Middleware Fastify - Injeta tenant no contexto
fastify.addHook('onRequest', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  const decoded = verifyJWT(token);
  
  request.tenantId = decoded.tenantId; // UUID do tenant
  request.userId = decoded.userId;
  request.userRole = decoded.role;
});

// Drizzle query sempre inclui tenant_id
const customers = await db.query.customers.findMany({
  where: eq(customers.tenant_id, request.tenantId)
});
```

**Por que NÃO serverless on-premise:**
- Overhead desnecessário para escopo acadêmico
- Dificulta debugging e desenvolvimento local
- Cold starts prejudicam UX
- Complexidade não justificada pelo problema (criação manual de lotes)

**Alternativas consideradas:**
- ❌ Microserviços: Over-engineering, comunicação entre serviços complexa
- ❌ Database-per-tenant: Custos operacionais altos, migrações complexas
- ❌ Serverless (Lambda): Custos AWS, vendor lock-in
- ✅ **Escolhido:** Monolith modular com RLS permite migração futura se necessário

---

### 4. Sistema de Entregas: Manual com Rastreamento Real-Time

**Decisão:** Criação manual de lotes + Redis Pub/Sub para rastreamento

**Fluxo Simplificado:**
1. **Admin cria vendas "para teleentrega"** (ficam pendentes)
2. **Admin monta lote manualmente:** seleciona vendas + atribui motoboy
3. **Motoboy inicia lote** no app (mesmo sistema, view diferente)
4. **Sistema envia WhatsApp** para todos os clientes: "Seu pedido saiu para entrega"
5. **Pub/Sub começa:** App motoboy publica localização periodicamente
6. **Server subscreve** e atualiza banco + envia via WebSocket para dashboard admin
7. **Admin visualiza** motoboy em tempo real no mapa

**Justificativa:**
- **Criação manual:** Operador conhece melhor a logística local (trânsito, prioridades)
- **Redis Pub/Sub:** Latência < 1ms, ideal para stream de coordenadas GPS
- **WebSocket bidirecional:** Admin acompanha entregas, motoboy recebe notificações
- **Simplicidade:** Sem algoritmos complexos de agrupamento, foco na UX

**Tecnologias de Notificação:**
- **WhatsApp:** Evolution API (gratuita, self-hosted) OU Twilio (paga)
- **WebSocket:** Socket.io para comunicação bidirecional
- **Geolocalização:** Browser Geolocation API no app do motoboy

---

### 5. Banco de Dados: PostgreSQL Multi-Tenant com Row-Level Security

**Decisão:** PostgreSQL como banco principal com isolamento por tenant_id (UUID)

**Estratégia Multi-Tenant:** Shared Database, Shared Schema (mais econômico)

**Schema Principais:**
```sql
-- Tabela de Tenants (Lancherias)
tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Todas as tabelas incluem tenant_id
customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, phone)  -- Telefone único por lancheria
)

products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
)

stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  type ENUM('IN', 'OUT') NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  type ENUM('LOCAL', 'DELIVERY') NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED') NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sale_id UUID NOT NULL REFERENCES sales(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
)

employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'EMPLOYEE', 'MOTOBOY') NOT NULL,
  email VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  daily_rate DECIMAL(10,2),  -- Para motoboys/funcionários
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
)

delivery_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  motoboy_id UUID NOT NULL REFERENCES employees(id),
  status ENUM('CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sale_id UUID NOT NULL REFERENCES sales(id),
  batch_id UUID REFERENCES delivery_batches(id),
  address TEXT NOT NULL,
  lat DECIMAL(10,8),  -- Latitude do endereço (fixo, do cadastro)
  lng DECIMAL(11,8),  -- Longitude do endereço (fixo, do cadastro)
  delivered_at TIMESTAMP
)

payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  work_date DATE NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, employee_id, work_date)
)
```

**Row-Level Security (RLS):**
```sql
-- Exemplo: Política de acesso para customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

**Otimizações:**
- **Índices compostos:** `(tenant_id, created_at)` em todas as tabelas
- **Particionamento:** `sales` e `payroll` por data (opcional para alta volumetria)
- **Materialized views:** Dashboard agregado por tenant
- **IMPORTANTE:** Geolocalização do motoboy NÃO é salva no banco (volátil)

**Por que NÃO salvar GPS no banco:**
- Dado efêmero (só vale no momento da transmissão)
- Alta frequência (10s) geraria milhões de registros inúteis
- Solução: Redis cache temporário (TTL 30s) + Socket.io broadcast

---

### 6. Padronização de Respostas da API (Gateway)

**Decisão:** Respostas consistentes e previsíveis em todas as rotas

**Formato Base:**
```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    tenant: string;
  };
}
```

#### Códigos de Status HTTP

**2xx - Sucesso**
```json
// 200 OK - Operação bem-sucedida
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "João Silva"
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc123",
    "tenant": "lancheria-xyz"
  }
}

// 201 Created - Recurso criado
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Novo Produto"
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc124"
  }
}

// 204 No Content - Operação sem retorno (DELETE)
// Sem body
```

**4xx - Erros do Cliente**
```json
// 400 Bad Request - Validação falhou
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos fornecidos",
    "details": {
      "fields": {
        "phone": "Telefone deve ter 10 ou 11 dígitos",
        "email": "Email inválido"
      }
    }
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc125"
  }
}

// 401 Unauthorized - Token inválido/ausente
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token de autenticação inválido ou expirado"
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc126"
  }
}

// 403 Forbidden - Sem permissão
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Você não tem permissão para acessar este recurso",
    "details": {
      "required_role": "ADMIN",
      "current_role": "MOTOBOY"
    }
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc127"
  }
}

// 404 Not Found - Recurso não encontrado
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Cliente não encontrado",
    "details": {
      "resource": "customer",
      "id": "550e8400-e29b-41d4-a716-446655440000"
    }
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc128"
  }
}

// 409 Conflict - Conflito de estado
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cliente com este telefone já existe",
    "details": {
      "field": "phone",
      "value": "51999887766"
    }
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc129"
  }
}

// 422 Unprocessable Entity - Regra de negócio violada
{
  "success": false,
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Não é possível iniciar lote sem entregas",
    "details": {
      "batch_id": "batch_123",
      "deliveries_count": 0
    }
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc130"
  }
}

// 429 Too Many Requests - Rate limit
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Limite de requisições excedido. Tente novamente em 60 segundos"
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc131",
    "retry_after": 60
  }
}
```

**5xx - Erros do Servidor**
```json
// 500 Internal Server Error - Erro não tratado
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Erro interno do servidor. Nossa equipe foi notificada."
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc132"
  }
}

// 503 Service Unavailable - Dependência externa falhou
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Serviço de WhatsApp temporariamente indisponível",
    "details": {
      "service": "evolution-api",
      "retry_after": 30
    }
  },
  "meta": {
    "timestamp": "2025-10-15T14:30:00Z",
    "requestId": "req_abc133"
  }
}
```

#### Códigos de Erro Customizados

```typescript
enum ErrorCode {
  // Autenticação/Autorização
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validação
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Recursos
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Regras de Negócio
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  BATCH_ALREADY_STARTED = 'BATCH_ALREADY_STARTED',
  DELIVERY_NOT_IN_BATCH = 'DELIVERY_NOT_IN_BATCH',
  
  // Multi-tenant
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_MISMATCH = 'TENANT_MISMATCH',
  
  // Sistema
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}
```

#### Implementação no Fastify (Error Handler Global)

```typescript
// src/shared/middlewares/errorHandler.ts
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = request.id;
  const tenantId = request.tenantId;

  // Log do erro (com stack trace em dev)
  request.log.error({
    err: error,
    requestId,
    tenantId,
    url: request.url,
    method: request.method
  });

  // Erro de validação (Zod)
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos fornecidos',
        details: {
          fields: error.validation.reduce((acc, err) => {
            acc[err.params.issue.path.join('.')] = err.message;
            return acc;
          }, {})
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        tenant: tenantId
      }
    });
  }

  // Erro customizado (do domínio)
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code || 'CLIENT_ERROR',
        message: error.message,
        details: error.details
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        tenant: tenantId
      }
    });
  }

  // Erro interno (não expor detalhes)
  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor. Nossa equipe foi notificada.'
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  });
}

// Registrar no Fastify
fastify.setErrorHandler(errorHandler);
```

#### Helper para Respostas de Sucesso

```typescript
// src/shared/utils/response.ts
export function successResponse<T>(data: T, meta?: any) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

// Uso nas rotas
fastify.get('/customers/:id', async (request, reply) => {
  const customer = await getCustomer(request.params.id, request.tenantId);
  
  return reply.send(successResponse(customer, {
    requestId: request.id,
    tenant: request.tenantId
  }));
});
```

**Justificativa:**
- **Consistência:** Frontend sempre sabe o que esperar
- **Debug facilitado:** `requestId` rastreia toda a requisição
- **Multi-tenant safe:** `tenant` em meta para auditoria
- **Type-safe:** Interface TypeScript compartilhada (monorepo)
- **Internacionalização futura:** Códigos em inglês, mensagens podem ser traduzidas

---

### 7. Containerização: Docker Compose

**Decisão:** Docker Compose para desenvolvimento e staging

**Serviços:**
```yaml
services:
  app:         # Next.js (dev mode)
  server:      # Fastify API
  postgres:    # Database
  redis:       # Cache + Pub/Sub
  adminer:     # DB management UI
```

**Justificativa:**
- Ambiente consistente entre desenvolvedores
- Setup rápido: `docker compose up`
- Produção: migrar para Kubernetes (opcional)

---

## Fluxos Críticos

### Fluxo 1: Criação Manual de Lote de Entregas
```
1. Admin acessa tela "Entregas Pendentes"
2. Visualiza lista de vendas "para teleentrega" (status: PENDING)
3. Seleciona múltiplas vendas (checkboxes)
4. Escolhe motoboy disponível (dropdown)
5. Clica "Criar Lote"
6. Sistema:
   - Cria registro delivery_batch (status: CREATED)
   - Vincula vendas ao lote (delivery_batch_items)
   - Atualiza status das vendas: PENDING → ASSIGNED
7. Lote aparece na view do motoboy (quando fizer login)
```

### Fluxo 2: Início de Entrega e Notificação de Clientes
```
1. Motoboy acessa app (mesmo sistema, view diferente)
2. Vê lista de lotes atribuídos a ele (status: CREATED)
3. Clica "Iniciar Lote"
4. Sistema:
   - Atualiza delivery_batch.status: CREATED → IN_PROGRESS
   - Inicia rastreamento GPS (pub/sub)
   - Envia WhatsApp para TODOS os clientes do lote:
     "Olá [Nome]! Seu pedido #[ID] saiu para entrega 🏍️"
5. App do motoboy mostra:
   - Mapa com marcadores das entregas
   - Lista de endereços ordenados
   - Botão "Marcar como Entregue" para cada item
```

### Fluxo 3: Rastreamento GPS em Tempo Real (Pub/Sub)
```
1. App do motoboy (quando lote IN_PROGRESS):
   - Ativa Geolocation API do navegador
   - A cada 10 segundos publica localização:
     
     PUBLISH motoboy:{tenantId}:{motoboyId}:location {
       lat: -29.123,
       lng: -51.456,
       timestamp: 1697654321,
       batchId: "batch_123"
     }

2. Server subscreve canal:
   SUBSCRIBE motoboy:{tenantId}:*:location
   
3. Ao receber coordenadas:
   - NÃO salva no banco (dado efêmero, só vale no momento)
   - Cache temporário no Redis (TTL 30s, apenas para fallback)
   - Emite IMEDIATAMENTE via Socket.io:
     io.to(`tenant-${tenantId}-admin`).emit('motoboy-location', data)

4. Dashboard admin renderiza:
   - Marcador do motoboy no mapa (atualiza a cada 10s)
   - Trail/rastro APENAS em memória (frontend state)
   - Se perder conexão, mostra última posição conhecida (do Redis cache)
   
IMPORTANTE: Geolocalização NÃO é persistida no banco. É dado volátil 
usado apenas para visualização real-time. Após 30s no Redis, expira.
```

### Fluxo 4: Finalização de Entrega Individual
```
1. Motoboy chega no endereço
2. Clica "Marcar como Entregue" no item específico
3. Sistema:
   - Atualiza delivery.status: IN_PROGRESS → DELIVERED
   - Salva timestamp de entrega
   - Envia WhatsApp ao cliente:
     "Seu pedido foi entregue! Obrigado pela preferência 😊"
4. Quando TODAS as entregas do lote são marcadas:
   - delivery_batch.status: IN_PROGRESS → COMPLETED
   - Para rastreamento GPS (motoboy pode descansar)
```

---

## Decisões Tecnológicas Complementares

### Gerenciamento de Estado (Frontend)
- **Server State:** React Query (cache, refetch, optimistic updates)
- **Client State:** Zustand (leve, < 1KB)
- **Formulários:** React Hook Form (performance) + Zod (validação)

### Segurança
- **Autenticação:** JWT (access + refresh tokens)
- **Multi-tenant security:** 
  - JWT inclui `tenantId` (não pode ser alterado pelo cliente)
  - Middleware valida tenant em TODAS as requisições
  - Row-Level Security (RLS) no PostgreSQL como segunda camada
- **Autorização:** RBAC (Admin, Funcionário, Motoboy)
  - Admin: acesso total ao seu tenant
  - Funcionário: vendas, estoque, clientes (sem financeiro)
  - Motoboy: apenas lotes atribuídos a ele
- **Middleware de roles:** Valida JWT e verifica permissões por rota
- **HTTPS:** Obrigatório em produção
- **Rate Limiting:** Fastify rate-limit por tenant (previne abuso de API)

### Observabilidade
- **Logs:** Pino (integrado ao Fastify)
- **Métricas:** Prometheus (opcional)
- **Tracing:** OpenTelemetry (futuro)

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Data leak entre tenants** | CRÍTICO | RLS no PostgreSQL + validação em middleware + testes automatizados |
| Escalabilidade do pub/sub | Alto | Redis Cluster ou migrar para RabbitMQ |
| Dependência de APIs externas (WhatsApp) | Médio | Fallback: SMS via Twilio ou notificação in-app |
| Perda de sinal GPS do motoboy | Médio | Cache última posição conhecida (Redis TTL 30s) |
| Múltiplos admins editando mesmo lote | Baixo | Optimistic locking (Drizzle) ou WebSocket sync |
| Bateria do celular do motoboy | Alto | Intervalo configurável (10s-60s), modo economia |
| Tenant órfão (lancheria fecha) | Baixo | Soft delete + rotina de limpeza mensal |

---

## Roadmap de Implementação

### Fase 1 (MVP - 4 semanas)
- [ ] Setup monorepo + Docker
- [ ] CRUD de clientes, produtos, vendas
- [ ] Dashboard básico (vendas diárias)
- [ ] Autenticação JWT

### Fase 2 (Entregas - 3 semanas)
- [ ] Cadastro de motoboys
- [ ] Tela "Criar Lote" (seleção manual de vendas)
- [ ] View do motoboy (lotes atribuídos)
- [ ] Sistema de rastreamento GPS (pub/sub)
- [ ] Mapa admin com posição real-time

### Fase 3 (Real-time - 2 semanas)
- [ ] Notificações WhatsApp (início e fim de entrega)
- [ ] WebSocket bidirectional (admin ↔ server ↔ motoboy)
- [ ] Botão "Marcar como Entregue"
- [ ] Histórico de rastreamento (trail no mapa)

### Fase 4 (Gestão - 1 semana)
- [ ] Folha de pagamento
- [ ] Relatórios avançados
- [ ] Backup automático

---

## Conclusão

Esta arquitetura equilibra **pragmatismo acadêmico** com **boas práticas de mercado**:

- ✅ Modular o suficiente para demonstrar separação de responsabilidades
- ✅ Tecnologias modernas e em alta demanda (Next.js, Fastify, Redis)
- ✅ Complexidade controlada (não é microserviços)
- ✅ Real-time sem over-engineering
- ✅ Preparado para evolução futura

**Diferenciais para apresentação acadêmica:**
1. **Multi-tenant architecture** com isolamento seguro (RLS + middleware)
2. **Redis Pub/Sub** para rastreamento GPS em tempo real (conceito avançado)
3. **Mesma aplicação, múltiplas views** (role-based UI)
4. Geolocalização efêmera (não persiste, otimização inteligente)
5. **API padronizada** com error handling robusto
6. Integração com API externa (WhatsApp)
7. WebSocket bidirecional (Socket.io)
8. Arquitetura event-driven sem over-engineering

---

## Referências

- [Fastify Best Practices](https://fastify.dev/docs/latest/Guides/Getting-Started/)
- [Next.js App Router Patterns](https://nextjs.org/docs/app)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Pub/Sub Guide](https://redis.io/docs/interact/pubsub/)
- [Leaflet Routing Machine](https://www.lrm.io/)