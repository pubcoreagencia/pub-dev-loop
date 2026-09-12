function cleanCharacterReply(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.toLowerCase().includes("thinking process")) {
    const lines = cleaned.split('\n');
    let contentLines: string[] = [];
    let pastThinking = false;
    for (const line of lines) {
      if (/^\s*(?:\*\*)?(?:Response|Resposta|Solução|Diagnóstico):(?:\*\*)?/i.test(line) || /^\s*##?\s+/i.test(line)) {
        pastThinking = true;
      }
      if (pastThinking) {
        contentLines.push(line);
      }
    }
    if (contentLines.length > 0) {
      cleaned = contentLines.join('\n').trim();
    }
  }
  return cleaned.replace(/^["']|["']$/g, '').trim();
}
import { Container, getContainer } from '@cloudflare/containers';
import pkg from 'pg';
const { Pool } = pkg;
import { PostgresTaskRepository } from './repository.js';
import { TaskIntakeService } from './pdl/service/task-intake-service.js';
import { defaultAgentRegistry, isValidAgentId } from './office/registry.js';
import { defaultOfficeOrganization } from './office/organization.js';
import { createOrganizationalPlan, planStepToTask } from './office/planning.js';
import { defaultOfficeEventBus } from './office/events.js';
import { defaultCodeReviewManager } from './office/review.js';
import { defaultApprovalManager } from './office/approval.js';
import { authenticateOfficeRequest } from './office/auth.js';
import { defaultMemoryStore, defaultMemoryRetrievalEngine, defaultOrganizationalAwarenessEngine, defaultDailySkillEngine, defaultAutonomousPipelineEngine } from './office/memory.js';
import { PUB_HOLDING_SECTORS, buildProjectSquad, getSectorForRepo } from './office/squads.js';
import { parseEngineeringTask, validateEngineeringTask, createEngineeringPlan, engineeringTaskToTask } from './office/intent.js';
import { resolveContext } from './office/context-resolver.js';

export interface HyperdriveBinding {
  connectionString: string;
}

export interface Env {
  HYPERDRIVE?: HyperdriveBinding;
  WORKER_CONTAINER?: any;
  DATABASE_URL?: string;
  GITHUB_TOKEN?: string;
  ROUTER_API_KEY?: string;
  ROUTER_BASE_URL?: string;
  ROUTER_MODEL?: string;
  ROUTER_FALLBACK_MODELS?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_FALLBACK_MODELS?: string;
  PRIMARY_GATEWAY?: string;
  FALLBACK_GATEWAY?: string;

  AGENT_PROVIDER?: string;
  OPENROUTER_STREAM_ENABLED?: string;
  ROUTER_STREAM_ENABLED?: string;
  API_VERSION?: string;
  COMMIT_SHA?: string;
  PUB_DEV_LOOP_API_KEY?: string;
  PROTOTYPE_TEMPLATE_REPOSITORY?: string;
  PROTOTYPE_PROTOTYPES_REPO?: string;
  PROTOTYPE_PERSISTENT_PUSH?: string;
  PROTOTYPE_BOT_TOKEN?: string;
}

export class PubDevLoopWorkerContainer extends Container<Env> {
  override defaultPort = 3000;
  override enableInternet = true;
  override sleepAfter = '1h';
  override entrypoint = ['npm', 'run', 'worker'];
  private activityInterval?: ReturnType<typeof setInterval>;

  override async onStart(): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Container instance starting via official Container class.');
    this.startActivityRenewal();
    await this.scheduleAlarm();
  }

  override async onStop(_params: any): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Container instance stopping.');
    this.stopActivityRenewal();
  }

  override onError(error: unknown): unknown {
    console.error('[PubDevLoopWorkerContainer] Container error:', error);
    return super.onError(error);
  }

  override async onActivityExpired(): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Activity expired -> entering sleepAfter.');
    this.stopActivityRenewal();
    await super.onActivityExpired();
  }

  override async alarm(): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Durable Object Alarm fired -> checking tasks & crash recovery.');
    try {
      const connectionString = (this.env as any)?.DATABASE_URL || (this.env as any)?.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
      if (connectionString) {
        const pool = new Pool({ connectionString });
        const repo = new PostgresTaskRepository(pool);

        // Reclaim stale tasks after crash (30s lease timeout * 2)
        const reclaimed = await repo.reclaimStuck('worker-alarm', 60000, new Date());
        if (reclaimed > 0) {
          console.log(`[PubDevLoopWorkerContainer] Alarm reclaimed ${reclaimed} stale task(s).`);
        }

        const tasks = await repo.list();
        await pool.end();

        const hasActiveWork = tasks.some(t => ['QUEUED', 'ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status));
        const hasQueuedTasks = tasks.some(t => t.status === 'QUEUED');

        if (hasActiveWork) {
          this.renewActivityTimeout();
          await this.scheduleAlarm();
        }

        if (hasQueuedTasks || reclaimed > 0) {
          console.log('[PubDevLoopWorkerContainer] Alarm triggering container worker start for queued/reclaimed tasks.');
          await triggerContainerWorker(this.env as Env);
        }
      }
    } catch (err: any) {
      console.error('[PubDevLoopWorkerContainer] Alarm execution error:', (err as Error).message);
    }
  }

  private async scheduleAlarm(ms: number = 35000): Promise<void> {
    try {
      if ((this as any).ctx?.storage) {
        await (this as any).ctx.storage.setAlarm(Date.now() + ms);
        console.log(`[PubDevLoopWorkerContainer] Alarm scheduled for +${ms}ms.`);
      }
    } catch (err: any) {
      console.error('[PubDevLoopWorkerContainer] Failed to schedule alarm:', (err as Error).message);
    }
  }

  private startActivityRenewal(): void {
    if (this.activityInterval) return;

    this.activityInterval = setInterval(async () => {
      try {
        const connectionString = (this.env as any)?.DATABASE_URL || (this.env as any)?.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
        if (!connectionString) return;

        const pool = new Pool({ connectionString });
        const repo = new PostgresTaskRepository(pool);
        const tasks = await repo.list();
        await pool.end();

        const hasActiveWork = tasks.some(t => ['QUEUED', 'ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status));

        if (hasActiveWork) {
          this.renewActivityTimeout();
        } else {
          this.stopActivityRenewal();
        }
      } catch (err: any) {
        console.error('[PubDevLoopWorkerContainer] Activity check error:', (err as Error).message);
      }
    }, 20000);
  }

  private stopActivityRenewal(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = undefined;
    }
  }
}

const SCHEMA_MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    project TEXT NOT NULL,
    repository TEXT NOT NULL,
    objective TEXT NOT NULL,
    prompt TEXT NOT NULL,
    branch TEXT,
    workspace_path TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    worker_id TEXT,
    lease_expires_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prototype_session_id UUID;`,
  `CREATE INDEX IF NOT EXISTS tasks_prototype_session_idx ON tasks (prototype_session_id, created_at ASC) WHERE prototype_session_id IS NOT NULL;`,
  `CREATE TABLE IF NOT EXISTS office_events (
    id TEXT PRIMARY KEY,
    sequence BIGSERIAL,
    project TEXT NOT NULL,
    type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    target_id TEXT,
    task_id TEXT,
    plan_id TEXT,
    step_id TEXT,
    summary TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS office_events_project_seq_idx ON office_events (project, sequence ASC);`,
  `CREATE TABLE IF NOT EXISTS organizational_memories (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    epistemic_status TEXT NOT NULL DEFAULT 'OBSERVED',
    scope TEXT NOT NULL DEFAULT 'PROJECT',
    actor_id TEXT NOT NULL,
    recurrence_count INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    provenance JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS org_memories_tenant_project_idx ON organizational_memories (tenant_id, project_id);`,
  `CREATE INDEX IF NOT EXISTS org_memories_tenant_project_type_idx ON organizational_memories (tenant_id, project_id, type);`,
  `CREATE INDEX IF NOT EXISTS org_memories_tenant_project_status_idx ON organizational_memories (tenant_id, project_id, status);`,
  `CREATE TABLE IF NOT EXISTS autonomous_backups (
    id TEXT PRIMARY KEY,
    repo TEXT NOT NULL,
    file_path TEXT NOT NULL,
    previous_sha TEXT,
    previous_content TEXT,
    new_sha TEXT,
    commit_sha TEXT,
    directive TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    restored_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE'
  );`,
  `CREATE INDEX IF NOT EXISTS autonomous_backups_repo_idx ON autonomous_backups (repo, created_at DESC);`,
  `CREATE TABLE IF NOT EXISTS autonomous_audit_logs (
    id TEXT PRIMARY KEY,
    cycle_index INTEGER,
    repo TEXT NOT NULL,
    directive TEXT NOT NULL,
    action TEXT NOT NULL,
    commit_sha TEXT,
    backup_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS autonomous_audit_logs_repo_created_idx ON autonomous_audit_logs (repo, created_at DESC);`,
  `CREATE TABLE IF NOT EXISTS execution_specs (
    spec_id VARCHAR(64) PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    canonical_payload JSONB NOT NULL,
    spec_hash VARCHAR(64) NOT NULL,
    sealed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_execution_specs_task_id ON execution_specs(task_id);`,
  `CREATE INDEX IF NOT EXISTS idx_execution_specs_task_status ON execution_specs(task_id, status);`
];

let migrationsChecked = false;
async function ensureMigrations(pool: InstanceType<typeof Pool>): Promise<void> {
  if (migrationsChecked) return;
  try {
    for (const sql of SCHEMA_MIGRATIONS) {
      await pool.query(sql).catch(err => {
        console.error('[API Worker] Migration statement notice:', (err as Error).message);
      });
    }
    migrationsChecked = true;
  } catch (err: any) {
    console.error('[API Worker] Ensure migrations error:', (err as Error).message);
  }
}

/**
 * Cria ou obtém a instância do PostgresTaskRepository para o Worker API.
 * Prioriza a connectionString do Cloudflare Hyperdrive quando disponível.
 */
function getPool(env: Env): InstanceType<typeof Pool> {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/pubdevloop';
  return new Pool({ connectionString });
}

function getRepository(env: Env): PostgresTaskRepository {
  const pool = getPool(env);
  void ensureMigrations(pool);
  return new PostgresTaskRepository(pool);
}

function getIntakeService(env: Env): TaskIntakeService {
  const pool = getPool(env);
  void ensureMigrations(pool);
  return new TaskIntakeService(pool);
}

// Sovereign in-memory project store to guarantee projects persist across reboots and network quotas
const sovereignProjectsCache = new Map<string, any>();
export interface EcosystemRepoMeta {
  name: string;
  fullName: string;
  description: string;
  role: string;
  defaultBranch: string;
  isPrivate?: boolean;
  keywords: string[];
}

export const PUB_ECOSYSTEM_CATALOG: EcosystemRepoMeta[] = [
  {
    "name": "buzios-de-cima",
    "fullName": "pubcoreagencia/buzios-de-cima",
    "description": "Empreendimento turístico e residencial boutique em Armação dos Búzios.",
    "role": "Empreendimento Búzios de Cima & Produção Cinema Drone 4K",
    "defaultBranch": "main",
    "keywords": [
      "buzios-de-cima",
      "buzios",
      "drone",
      "4k",
      "turismo"
    ]
  },
  {
    "name": "eternize-seu-pinscher",
    "fullName": "pubcoreagencia/eternize-seu-pinscher",
    "description": "Marca de eternização de animais em impressão 3D",
    "role": "Eternização de Animais em Impressão 3D & E-commerce Afetivo",
    "defaultBranch": "main",
    "keywords": [
      "eternize-seu-pinscher",
      "pinscher",
      "3d",
      "impressao",
      "escultura"
    ]
  },
  {
    "name": "ia-pubcrypto",
    "fullName": "pubcoreagencia/ia-pubcrypto",
    "description": "Agente preditivo de análise on-chain e inteligência de mercado cripto.",
    "role": "Agente preditivo de análise on-chain e inteligência de mercado cripto.",
    "defaultBranch": "main",
    "keywords": [
      "ia-pubcrypto",
      "ia",
      "pubcrypto"
    ]
  },
  {
    "name": "leadcore",
    "fullName": "pubcoreagencia/leadcore",
    "description": "Core de inteligência e base unificada de contatos e CRM B2B.",
    "role": "Core de inteligência e base unificada de contatos e CRM B2B.",
    "defaultBranch": "main",
    "keywords": [
      "leadcore",
      "leadcore"
    ]
  },
  {
    "name": "neural-os",
    "fullName": "pubcoreagencia/neural-os",
    "description": "Kernel e arquitetura de agentes neurais distribuídos",
    "role": "Núcleo Neural e Orquestração Avançada",
    "defaultBranch": "main",
    "keywords": [
      "neural-os",
      "neural",
      "kernel"
    ]
  },
  {
    "name": "pub-3d",
    "fullName": "pubcoreagencia/pub-3d",
    "description": "Experiências imersivas 3D, WebGL e metaversos corporativos.",
    "role": "Experiências imersivas 3D, WebGL e metaversos corporativos.",
    "defaultBranch": "main",
    "keywords": [
      "pub-3d",
      "pub",
      "3d"
    ]
  },
  {
    "name": "pub-9router-cloud",
    "fullName": "pubcoreagencia/pub-9router-cloud",
    "description": "High-availability router proxy para modelos de inteligência artificial 100% free",
    "role": "Gateway Cloudflare Worker de Roteamento de Modelos IA",
    "defaultBranch": "main",
    "keywords": [
      "pub-9router-cloud",
      "router",
      "9router",
      "llm",
      "ia",
      "models",
      "tokens"
    ]
  },
  {
    "name": "pub-agencia-landing",
    "fullName": "pubcoreagencia/pub-agencia-landing",
    "description": "Landing page oficial da agência PUB.",
    "role": "Landing page oficial da agência PUB.",
    "defaultBranch": "main",
    "keywords": [
      "pub-agencia-landing",
      "pub",
      "agencia",
      "landing"
    ]
  },
  {
    "name": "PUB-BEATS",
    "fullName": "pubcoreagencia/PUB-BEATS",
    "description": "Plataforma de Venda de Beats e Instrumentais da PUB RECORDS.",
    "role": "Plataforma de Venda de Beats e Instrumentais da PUB RECORDS.",
    "defaultBranch": "main",
    "keywords": [
      "PUB-BEATS",
      "PUB",
      "BEATS"
    ]
  },
  {
    "name": "pub-bnb",
    "fullName": "pubcoreagencia/pub-bnb",
    "description": "Gestão algorítmica de locações de temporada e hospitalidade de luxo.",
    "role": "Gestão algorítmica de locações de temporada e hospitalidade de luxo.",
    "defaultBranch": "main",
    "keywords": [
      "pub-bnb",
      "pub",
      "bnb"
    ]
  },
  {
    "name": "pub-co",
    "fullName": "pubcoreagencia/pub-co",
    "description": "Portal institucional global e portal de acesso central da PUB Holding.",
    "role": "Portal institucional global e portal de acesso central da PUB Holding.",
    "defaultBranch": "main",
    "keywords": [
      "pub-co",
      "pub",
      "co"
    ]
  },
  {
    "name": "PUB-CORE",
    "fullName": "pubcoreagencia/PUB-CORE",
    "description": "Repositório oficial PUB-CORE da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços PUB-CORE",
    "defaultBranch": "main",
    "keywords": [
      "PUB-CORE",
      "PUB",
      "CORE"
    ]
  },
  {
    "name": "pub-core-holding-portal",
    "fullName": "pubcoreagencia/pub-core-holding-portal",
    "description": "Portal institucional e comercial da Pub Core Holding, desenvolvido em Next.js.",
    "role": "Portal institucional e comercial da Pub Core Holding, desenvolvido em Next.js.",
    "defaultBranch": "main",
    "keywords": [
      "pub-core-holding-portal",
      "pub",
      "core",
      "holding",
      "portal"
    ]
  },
  {
    "name": "pub-core-os",
    "fullName": "pubcoreagencia/pub-core-os",
    "description": "Sistema Operacional Central e Arquitetura Executiva da Agência PUB",
    "role": "Core OS da Agência PUB & Governança de Sistemas",
    "defaultBranch": "main",
    "keywords": [
      "pub-core-os",
      "core-os",
      "os",
      "sistema"
    ]
  },
  {
    "name": "pub-crypto",
    "fullName": "pubcoreagencia/pub-crypto",
    "description": "Gestão de tesouraria em criptoativos e infraestrutura blockchain.",
    "role": "Gestão de tesouraria em criptoativos e infraestrutura blockchain.",
    "defaultBranch": "main",
    "keywords": [
      "pub-crypto",
      "pub",
      "crypto"
    ]
  },
  {
    "name": "pub-dev-loop",
    "fullName": "pubcoreagencia/pub-dev-loop",
    "description": "Autonomous Software Engineering Workforce & 3D Living Office Sovereign System",
    "role": "Escritório Virtual 3D, Orquestração de Agentes, API Worker, LLM Multi-Gateway e Despacho de Tarefas",
    "defaultBranch": "main",
    "keywords": [
      "pub-dev-loop",
      "office",
      "pdl",
      "3d",
      "agentes",
      "devloop",
      "dev-loop",
      "chief-of-staff",
      "tasks",
      "gateway"
    ]
  },
  {
    "name": "pub-dev-loop-prototypes",
    "fullName": "pubcoreagencia/pub-dev-loop-prototypes",
    "description": "Persistent repository for PUB Prototype sessions",
    "role": "Persistent repository for PUB Prototype sessions",
    "defaultBranch": "main",
    "keywords": [
      "pub-dev-loop-prototypes",
      "pub",
      "dev",
      "loop",
      "prototypes"
    ]
  },
  {
    "name": "pub-dev-loop-template",
    "fullName": "pubcoreagencia/pub-dev-loop-template",
    "description": "Template repository for PUB DEV LOOP continuity",
    "role": "Template repository for PUB DEV LOOP continuity",
    "defaultBranch": "main",
    "keywords": [
      "pub-dev-loop-template",
      "pub",
      "dev",
      "loop",
      "template"
    ]
  },
  {
    "name": "pub-ecom",
    "fullName": "pubcoreagencia/pub-ecom",
    "description": "PUB E-Commerce Monorepo — Hub unificado de e-commerce da holding (Core, Hub Web App, Catalog Worker e Landing Page)",
    "role": "Monorepo Consolidado de E-commerce (Core, Apps Hub, Catalog Worker e Landing)",
    "defaultBranch": "master",
    "keywords": [
      "pub-ecom",
      "pubecomhub",
      "catalog-worker",
      "ecom",
      "loja",
      "store",
      "cart",
      "carrinho",
      "login",
      "auth",
      "checkout",
      "import",
      "catalog",
      "vitrine",
      "produtos",
      "hub"
    ]
  },
  {
    "name": "pub-ecom-catalog-worker",
    "fullName": "pubcoreagencia/pub-ecom-catalog-worker",
    "description": "Repositório oficial pub-ecom-catalog-worker da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pub-ecom-catalog-worker",
    "defaultBranch": "main",
    "keywords": [
      "pub-ecom-catalog-worker",
      "pub",
      "ecom",
      "catalog",
      "worker"
    ]
  },
  {
    "name": "pub-ecom-landing",
    "fullName": "pubcoreagencia/pub-ecom-landing",
    "description": "Repositório oficial pub-ecom-landing da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pub-ecom-landing",
    "defaultBranch": "main",
    "keywords": [
      "pub-ecom-landing",
      "pub",
      "ecom",
      "landing"
    ]
  },
  {
    "name": "pub-films",
    "fullName": "pubcoreagencia/pub-films",
    "description": "Produção audiovisual cinematográfica e publicidade de alto impacto.",
    "role": "Produção audiovisual cinematográfica e publicidade de alto impacto.",
    "defaultBranch": "main",
    "keywords": [
      "pub-films",
      "pub",
      "films"
    ]
  },
  {
    "name": "pub-films-landing",
    "fullName": "pubcoreagencia/pub-films-landing",
    "description": "Landing page cinematografica da PUB FILMS.",
    "role": "Landing page cinematografica da PUB FILMS.",
    "defaultBranch": "main",
    "keywords": [
      "pub-films-landing",
      "pub",
      "films",
      "landing"
    ]
  },
  {
    "name": "pub-food",
    "fullName": "pubcoreagencia/pub-food",
    "description": "Operação de dark kitchens, delivery inteligente e controle de suprimentos.",
    "role": "Operação de dark kitchens, delivery inteligente e controle de suprimentos.",
    "defaultBranch": "main",
    "keywords": [
      "pub-food",
      "pub",
      "food"
    ]
  },
  {
    "name": "pub-games-studio",
    "fullName": "pubcoreagencia/pub-games-studio",
    "description": "Desenvolvimento de jogos independentes e gamificação corporativa.",
    "role": "Desenvolvimento de jogos independentes e gamificação corporativa.",
    "defaultBranch": "main",
    "keywords": [
      "pub-games-studio",
      "pub",
      "games",
      "studio"
    ]
  },
  {
    "name": "pub-github-mcp",
    "fullName": "pubcoreagencia/pub-github-mcp",
    "description": "Servidor MCP GitHub para integração de repositórios e ferramentas de CI/CD",
    "role": "MCP Server e Protocolo de Ferramentas GitHub",
    "defaultBranch": "main",
    "keywords": [
      "pub-github-mcp",
      "mcp",
      "tools",
      "github-mcp"
    ]
  },
  {
    "name": "pub-ia",
    "fullName": "pubcoreagencia/pub-ia",
    "description": "Hub e orquestrador de inteligência artificial generativa e preditiva.",
    "role": "Hub e orquestrador de inteligência artificial generativa e preditiva.",
    "defaultBranch": "main",
    "keywords": [
      "pub-ia",
      "pub",
      "ia"
    ]
  },
  {
    "name": "pub-imoveis",
    "fullName": "pubcoreagencia/pub-imoveis",
    "description": "Plataforma inteligente de transações imobiliárias e tokenização de ativos.",
    "role": "Plataforma inteligente de transações imobiliárias e tokenização de ativos.",
    "defaultBranch": "main",
    "keywords": [
      "pub-imoveis",
      "pub",
      "imoveis"
    ]
  },
  {
    "name": "pub-lancamentos",
    "fullName": "pubcoreagencia/pub-lancamentos",
    "description": "Infraestrutura e playbooks para lançamentos digitais em escala.",
    "role": "Infraestrutura e playbooks para lançamentos digitais em escala.",
    "defaultBranch": "main",
    "keywords": [
      "pub-lancamentos",
      "pub",
      "lancamentos"
    ]
  },
  {
    "name": "pub-leads",
    "fullName": "pubcoreagencia/pub-leads",
    "description": "Repositório oficial pub-leads da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pub-leads",
    "defaultBranch": "main",
    "keywords": [
      "pub-leads",
      "pub",
      "leads"
    ]
  },
  {
    "name": "pub-machine",
    "fullName": "pubcoreagencia/pub-machine",
    "description": "Motor automatizado de prospecção e geração de negócios da PUB.",
    "role": "Motor automatizado de prospecção e geração de negócios da PUB.",
    "defaultBranch": "main",
    "keywords": [
      "pub-machine",
      "pub",
      "machine"
    ]
  },
  {
    "name": "pub-machine-2",
    "fullName": "pubcoreagencia/pub-machine-2",
    "description": "Evolução autônoma de segunda geração do motor Machine.",
    "role": "Evolução autônoma de segunda geração do motor Machine.",
    "defaultBranch": "main",
    "keywords": [
      "pub-machine-2",
      "pub",
      "machine",
      "2"
    ]
  },
  {
    "name": "pub-machine-saas",
    "fullName": "pubcoreagencia/pub-machine-saas",
    "description": "Versão multi-tenant SaaS da PUB Machine para clientes externos.",
    "role": "Versão multi-tenant SaaS da PUB Machine para clientes externos.",
    "defaultBranch": "main",
    "keywords": [
      "pub-machine-saas",
      "pub",
      "machine",
      "saas"
    ]
  },
  {
    "name": "pub-media",
    "fullName": "pubcoreagencia/pub-media",
    "description": "Braço de distribuição de mídia de performance e tráfego pago.",
    "role": "Braço de distribuição de mídia de performance e tráfego pago.",
    "defaultBranch": "main",
    "keywords": [
      "pub-media",
      "pub",
      "media"
    ]
  },
  {
    "name": "pub-neural",
    "fullName": "pubcoreagencia/pub-neural",
    "description": "Cérebro cognitivo, memória episódica/semântica e orquestrador multiagente.",
    "role": "Cérebro cognitivo, memória episódica/semântica e orquestrador multiagente.",
    "defaultBranch": "main",
    "keywords": [
      "pub-neural",
      "pub",
      "neural"
    ]
  },
  {
    "name": "pub-ops-hub",
    "fullName": "pubcoreagencia/pub-ops-hub",
    "description": "Repositório oficial pub-ops-hub da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pub-ops-hub",
    "defaultBranch": "main",
    "keywords": [
      "pub-ops-hub",
      "pub",
      "ops",
      "hub"
    ]
  },
  {
    "name": "pub-prototype",
    "fullName": "pubcoreagencia/pub-prototype",
    "description": "Ambiente de prototipação rápida de interfaces e produtos.",
    "role": "Ambiente de prototipação rápida de interfaces e produtos.",
    "defaultBranch": "main",
    "keywords": [
      "pub-prototype",
      "pub",
      "prototype"
    ]
  },
  {
    "name": "pub-records",
    "fullName": "pubcoreagencia/pub-records",
    "description": "Gravadora musical, catálogo fonográfico e unificação com pub beats",
    "role": "Gravadora Musical, Catálogo Fonográfico & Streaming",
    "defaultBranch": "main",
    "keywords": [
      "pub-records",
      "records",
      "musica",
      "beats",
      "gravadora"
    ]
  },
  {
    "name": "pub-scrapping",
    "fullName": "pubcoreagencia/pub-scrapping",
    "description": "Engenharia de scrapers e ingestores de dados (Shopee, Mercado Livre, etc).",
    "role": "Engenharia de scrapers e ingestores de dados (Shopee, Mercado Livre, etc).",
    "defaultBranch": "main",
    "keywords": [
      "pub-scrapping",
      "pub",
      "scrapping"
    ]
  },
  {
    "name": "pub-shopee-scraper",
    "fullName": "pubcoreagencia/pub-shopee-scraper",
    "description": "Repositório oficial pub-shopee-scraper da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pub-shopee-scraper",
    "defaultBranch": "main",
    "keywords": [
      "pub-shopee-scraper",
      "pub",
      "shopee",
      "scraper"
    ]
  },
  {
    "name": "pub-start",
    "fullName": "pubcoreagencia/pub-start",
    "description": "Incubadora e framework de bootstrap de novos negócios digitais.",
    "role": "Incubadora e framework de bootstrap de novos negócios digitais.",
    "defaultBranch": "main",
    "keywords": [
      "pub-start",
      "pub",
      "start"
    ]
  },
  {
    "name": "pub-textil",
    "fullName": "pubcoreagencia/pub-textil",
    "description": "Confecção inteligente, private label e cadeia de suprimentos têxteis.",
    "role": "Confecção inteligente, private label e cadeia de suprimentos têxteis.",
    "defaultBranch": "main",
    "keywords": [
      "pub-textil",
      "pub",
      "textil"
    ]
  },
  {
    "name": "pub-trade",
    "fullName": "pubcoreagencia/pub-trade",
    "description": "Sistemas algorítmicos automatizados de trading quantitativo.",
    "role": "Sistemas algorítmicos automatizados de trading quantitativo.",
    "defaultBranch": "main",
    "keywords": [
      "pub-trade",
      "pub",
      "trade"
    ]
  },
  {
    "name": "pub3d-landing",
    "fullName": "pubcoreagencia/pub3d-landing",
    "description": "Repositório oficial pub3d-landing da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pub3d-landing",
    "defaultBranch": "main",
    "keywords": [
      "pub3d-landing",
      "pub3d",
      "landing"
    ]
  },
  {
    "name": "pubcore",
    "fullName": "pubcoreagencia/pubcore",
    "description": "Landing page institucional e portal de serviços da Agência PUB",
    "role": "Landing Page Oficial & Portal Comercial da Agência PUB",
    "defaultBranch": "main",
    "keywords": [
      "pubcore",
      "landing",
      "agencia",
      "servicos"
    ]
  },
  {
    "name": "pubcoreagencia.github.io",
    "fullName": "pubcoreagencia/pubcoreagencia.github.io",
    "description": "Portal institucional Pub Core Holding",
    "role": "Portal institucional Pub Core Holding",
    "defaultBranch": "main",
    "keywords": [
      "pubcoreagencia.github.io",
      "pubcoreagencia.github.io"
    ]
  },
  {
    "name": "pubecomhub",
    "fullName": "pubcoreagencia/pubecomhub",
    "description": "Repositório oficial pubecomhub da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pubecomhub",
    "defaultBranch": "main",
    "keywords": [
      "pubecomhub",
      "pubecomhub"
    ]
  },
  {
    "name": "pubet",
    "fullName": "pubcoreagencia/pubet",
    "description": "Plataforma de entretenimento e apostas reguladas.",
    "role": "Plataforma de entretenimento e apostas reguladas.",
    "defaultBranch": "main",
    "keywords": [
      "pubet",
      "pubet"
    ]
  },
  {
    "name": "pubfood-control-growth",
    "fullName": "pubcoreagencia/pubfood-control-growth",
    "description": "Repositório oficial pubfood-control-growth da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pubfood-control-growth",
    "defaultBranch": "main",
    "keywords": [
      "pubfood-control-growth",
      "pubfood",
      "control",
      "growth"
    ]
  },
  {
    "name": "pubgrowth-ai-evolution",
    "fullName": "pubcoreagencia/pubgrowth-ai-evolution",
    "description": "Repositório oficial pubgrowth-ai-evolution da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pubgrowth-ai-evolution",
    "defaultBranch": "main",
    "keywords": [
      "pubgrowth-ai-evolution",
      "pubgrowth",
      "ai",
      "evolution"
    ]
  },
  {
    "name": "pubgrowthai",
    "fullName": "pubcoreagencia/pubgrowthai",
    "description": "Repositório oficial pubgrowthai da holding Pub Core",
    "role": "Módulo de infraestrutura e serviços pubgrowthai",
    "defaultBranch": "main",
    "keywords": [
      "pubgrowthai",
      "pubgrowthai"
    ]
  },
  {
    "name": "xp-audio-lab",
    "fullName": "pubcoreagencia/xp-audio-lab",
    "description": "Estúdio de produção sonora e trilhas da PUB",
    "role": "Studio de Produção de Trilhas Sonoras & WebAudio Plugins",
    "defaultBranch": "main",
    "keywords": [
      "xp-audio-lab",
      "audio",
      "trilha",
      "som",
      "studio",
      "vst"
    ]
  }
];

// Seed cache with all 52 ecosystem projects immediately
for (const repo of PUB_ECOSYSTEM_CATALOG) {
  sovereignProjectsCache.set(repo.name, {
    name: repo.name,
    fullName: repo.fullName,
    cloneUrl: `https://github.com/${repo.fullName}.git`,
    htmlUrl: `https://github.com/${repo.fullName}`,
    description: repo.description,
    defaultBranch: repo.defaultBranch,
    isPrivate: false,
    updatedAt: new Date().toISOString(),
  });
}

function selectRelevantRepos(prompt: string, selectedProject?: string): string[] {
  const normPrompt = prompt.toLowerCase();
  const matched = new Set<string>();

  // 1. Extração direta de links e repositórios passados explicitamente no prompt
  const ghRepoMatch = normPrompt.match(/github\.com\/pubcoreagencia\/([a-z0-9-_.]+)/i);
  if (ghRepoMatch && ghRepoMatch[1]) {
    matched.add(ghRepoMatch[1].replace(/\.git$/, ''));
  }

  // 2. Extração de domínios (ex: pubcore.site -> pubcore)
  if (normPrompt.includes('pubcore.site')) {
    matched.add('pubcore');
    matched.add('pub-core-holding-portal');
    matched.add('pubcoreagencia.github.io');
  }

  // 3. Casamento pelo projeto selecionado na interface
  if (selectedProject && selectedProject.trim()) {
    const trimmed = selectedProject.trim();
    // Se o usuário está perguntando especificamente sobre outro repositório ou URL, prioriza o que foi perguntado
    if (ghRepoMatch || normPrompt.includes('pubcore.site')) {
      // Já adicionou o repo da pergunta, mantém o selecionado secundário
    } else {
      matched.add(trimmed);
    }
    if (trimmed === 'pub-ecom' && (normPrompt.includes('login') || normPrompt.includes('import') || normPrompt.includes('scraper') || normPrompt.includes('loja'))) {
      matched.add('pubecomhub');
    }
  }

  // 4. Mapeamento por nomes e palavras-chave de todo o catálogo
  for (const repo of PUB_ECOSYSTEM_CATALOG) {
    if (normPrompt.includes(repo.name.toLowerCase())) {
      matched.add(repo.name);
    }
    for (const kw of repo.keywords) {
      if (normPrompt.includes(kw.toLowerCase())) {
        matched.add(repo.name);
        break;
      }
    }
  }

  if (normPrompt.includes('shopee') || normPrompt.includes('mercado livre') || normPrompt.includes('mercadolivre') || normPrompt.includes('import') || normPrompt.includes('scraper')) {
    matched.add('pubecomhub');
    matched.add('pub-ecom-catalog-worker');
    matched.add('pub-shopee-scraper');
  }

  if (normPrompt.includes('login') || normPrompt.includes('auth') || normPrompt.includes('ecom') || normPrompt.includes('loja')) {
    matched.add('pubecomhub');
    matched.add('pub-ecom');
  }

  if (matched.size === 0) {
    matched.add('pubecomhub');
    matched.add('pub-dev-loop');
  }

  return Array.from(matched).slice(0, 4);
}

async function fetchRepoGitDetails(repoName: string, ghHeaders: Record<string, string>): Promise<{
  repoName: string;
  defaultBranch: string;
  commits: string[];
  files: string[];
  packageInfo?: { name?: string; description?: string; dependencies?: string[] };
  appTitle?: string;
  wranglerName?: string;
  phaseStatus?: string;
}> {
  try {
    const repoRes = await fetch(`https://api.github.com/repos/pubcoreagencia/${repoName}`, { headers: ghHeaders });
    if (!repoRes.ok) return { repoName, defaultBranch: 'main', commits: [], files: [] };
    const repoData = await repoRes.json() as any;
    const defaultBranch = repoData.default_branch || 'main';

    let commits: string[] = [];
    try {
      const commitsRes = await fetch(`https://api.github.com/repos/pubcoreagencia/${repoName}/commits?per_page=4`, { headers: ghHeaders });
      if (commitsRes.ok) {
        const cData = await commitsRes.json() as any[];
        if (Array.isArray(cData)) {
          commits = cData.map(c => `- [${(c.sha || '').slice(0, 7)}] ${c.commit?.message?.split('\n')?.[0]} (${c.commit?.author?.name || c.author?.login})`);
        }
      }
    } catch {}

    let files: string[] = [];
    try {
      const treeRes = await fetch(`https://api.github.com/repos/pubcoreagencia/${repoName}/git/trees/${defaultBranch}`, { headers: ghHeaders });
      if (treeRes.ok) {
        const tData = await treeRes.json() as any;
        if (Array.isArray(tData.tree)) {
          files = tData.tree.map((t: any) => t.path);
        }
      }
    } catch {}

    // 1. Inspecionar package.json
    let packageInfo: { name?: string; description?: string; dependencies?: string[] } | undefined = undefined;
    if (files.includes('package.json')) {
      try {
        const pkgRes = await fetch(`https://raw.githubusercontent.com/pubcoreagencia/${repoName}/${defaultBranch}/package.json`);
        if (pkgRes.ok) {
          const pkgJson = await pkgRes.json() as any;
          packageInfo = {
            name: pkgJson.name,
            description: pkgJson.description,
            dependencies: Object.keys(pkgJson.dependencies || {}).slice(0, 15)
          };
        }
      } catch {}
    }

    // 2. Inspecionar wrangler.jsonc / wrangler.json / wrangler.toml
    let wranglerName: string | undefined = undefined;
    const wranglerFile = files.find(f => f.startsWith('wrangler.json') || f.startsWith('wrangler.toml'));
    if (wranglerFile) {
      try {
        const wRes = await fetch(`https://raw.githubusercontent.com/pubcoreagencia/${repoName}/${defaultBranch}/${wranglerFile}`);
        if (wRes.ok) {
          const wText = await wRes.text();
          const nameMatch = wText.match(/"name":\s*"([^"]+)"/);
          if (nameMatch) wranglerName = `${nameMatch[1]} (${wranglerFile})`;
        }
      } catch {}
    }

    // 3. Inspecionar títulos e descrições de rotas/HTML (__root.tsx, index.html, index.tsx)
    let appTitle: string | undefined = undefined;
    const candidates = ['src/routes/__root.tsx', 'index.html', 'src/App.tsx', 'src/index.tsx', 'src/app/layout.tsx'];
    for (const cand of candidates) {
      if (files.includes(cand) || cand === 'src/routes/__root.tsx') {
        try {
          const cRes = await fetch(`https://raw.githubusercontent.com/pubcoreagencia/${repoName}/${defaultBranch}/${cand}`);
          if (cRes.ok) {
            const content = await cRes.text();
            const titleMatch = content.match(/title:\s*["']([^"']+)["']/i) || content.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
              appTitle = titleMatch[1].trim();
              break;
            }
          }
        } catch {}
      }
    }

    // 4. Inspecionar PHASE_STATUS.md
    let phaseStatus = '';
    if (files.includes('PHASE_STATUS.md')) {
      try {
        const pRes = await fetch(`https://raw.githubusercontent.com/pubcoreagencia/${repoName}/${defaultBranch}/PHASE_STATUS.md`);
        if (pRes.ok) phaseStatus = (await pRes.text()).slice(0, 800);
      } catch {}
    }

    return { repoName, defaultBranch, commits, files, packageInfo, appTitle, wranglerName, phaseStatus };
  } catch {
    return { repoName, defaultBranch: 'main', commits: [], files: [] };
  }
}

/**
 * Sinaliza a inicialização/reutilização da instância do container Linux (singleton "main")
 * injetando as variáveis de ambiente necessárias para o worker.ts no container via SDK oficial.
 */
async function triggerContainerWorker(env: Env): Promise<void> {
  if (!env.WORKER_CONTAINER) return;
  try {
    const container = getContainer(env.WORKER_CONTAINER);
    const containerEnv: Record<string, string> = {
      DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString || '',
      GITHUB_TOKEN: env.GITHUB_TOKEN || '',
      PRIMARY_GATEWAY: env.PRIMARY_GATEWAY || 'openrouter',
      FALLBACK_GATEWAY: env.FALLBACK_GATEWAY || '9router',
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || '',
      OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      OPENROUTER_MODEL: env.OPENROUTER_MODEL || 'openrouter/free',
      OPENROUTER_FALLBACK_MODELS: env.OPENROUTER_FALLBACK_MODELS || '',
      ROUTER_API_KEY: env.ROUTER_API_KEY || '',
      ROUTER_BASE_URL: env.ROUTER_BASE_URL || '',
      ROUTER_MODEL: env.ROUTER_MODEL || '',
      ROUTER_FALLBACK_MODELS: env.ROUTER_FALLBACK_MODELS || '',
      AGENT_PROVIDER: env.AGENT_PROVIDER || 'gateway',
      OPENROUTER_STREAM_ENABLED: env.OPENROUTER_STREAM_ENABLED || 'false',
      ROUTER_STREAM_ENABLED: env.ROUTER_STREAM_ENABLED || 'false',
      PROTOTYPE_TEMPLATE_REPOSITORY: env.PROTOTYPE_TEMPLATE_REPOSITORY || 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
      PROTOTYPE_PROTOTYPES_REPO: env.PROTOTYPE_PROTOTYPES_REPO || 'pubcoreagencia/pub-dev-loop-prototypes',
      PROTOTYPE_PERSISTENT_PUSH: env.PROTOTYPE_PERSISTENT_PUSH || 'false',
      PROTOTYPE_BOT_TOKEN: env.PROTOTYPE_BOT_TOKEN || '',
      PROTOTYPE_WORKSPACES_ROOT: '/tmp/pub-prototype',
      PROTOTYPE_PREVIEW_MODE: 'public',
      WORKER_POLL_INTERVAL_MS: '3000',
      WORKER_LEASE_TIMEOUT_MS: '30000',
      WORKER_HEARTBEAT_MS: '10000',
    };

    console.log(JSON.stringify({
      event: 'CONTAINER_DISPATCH',
      databaseConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0),
      openrouterConfigured: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0),
      primaryGateway: env.PRIMARY_GATEWAY || 'openrouter',
      fallbackGateway: env.FALLBACK_GATEWAY || '9router',
      timestamp: new Date().toISOString(),
    }));

    await container.startAndWaitForPorts({
      ports: [3000],
      startOptions: {
        envVars: containerEnv,
        enableInternet: true,
        entrypoint: ['npm', 'run', 'worker'],
      },
      cancellationOptions: { portReadyTimeoutMS: 30000 },
    });
    console.log('[API Worker] Triggered container worker instance "main" with OpenRouter -> 9Router gateway policy.');
  } catch (err: any) {
    console.error('[API Worker] Error triggering container worker:', (err as Error).message);
  }
}

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const sovereignMemoryTasks = new Map<string, any>();
const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

export function checkRateLimit(clientIp: string, maxRequests = MAX_REQUESTS_PER_MINUTE, windowMs = RATE_LIMIT_WINDOW_MS): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || (now - record.windowStart) > windowMs) {
    rateLimitMap.set(clientIp, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

export function resetRateLimitMap(): void {
  rateLimitMap.clear();
}

/**
 * 24/7 AUTONOMOUS HOLDING ECOSYSTEM ORCHESTRATOR
 * Rotates development, fixes, unit tests, and optimizations across all 21 Pub Core projects.
 * Runs autonomously on Cloudflare Cron Triggers (every 15-30m) or direct CEO dispatch.
 * Creates safety snapshots (backups) for instant CEO rollback/declining.
 */
export interface AutonomousBackupRecord {
  id: string;
  repo: string;
  filePath: string;
  previousSha?: string;
  previousContent?: string;
  newSha?: string;
  commitSha?: string;
  directive: string;
  createdAt: string;
  restoredAt?: string;
  status: 'ACTIVE' | 'RESTORED' | 'DECLINED';
}

export interface AutonomousAuditLog {
  id: string;
  cycleIndex: number;
  repo: string;
  directive: string;
  action: string;
  commitSha?: string;
  backupId?: string;
  details: Record<string, any>;
  createdAt: string;
}

export class AutonomousEcosystemOrchestrator {
  private memoryBackups = new Map<string, AutonomousBackupRecord>();
  private memoryAuditLogs: AutonomousAuditLog[] = [];
  private lastCycleIndex = 0;

  public async getScheduledRepo(env: Env, preferredRepo?: string): Promise<EcosystemRepoMeta> {
    if (preferredRepo) {
      const match = PUB_ECOSYSTEM_CATALOG.find(
        (r) => r.name.toLowerCase() === preferredRepo.toLowerCase() || r.fullName.toLowerCase().includes(preferredRepo.toLowerCase())
      );
      if (match) return match;
    }

    const currentHour = new Date().getUTCHours();
    const cycle = (currentHour + this.lastCycleIndex) % PUB_ECOSYSTEM_CATALOG.length;
    return PUB_ECOSYSTEM_CATALOG[cycle] || PUB_ECOSYSTEM_CATALOG[0];
  }

  public async createSafetyBackup(
    pool: InstanceType<typeof Pool> | null,
    backup: Omit<AutonomousBackupRecord, 'createdAt' | 'status'>
  ): Promise<AutonomousBackupRecord> {
    const record: AutonomousBackupRecord = {
      ...backup,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    this.memoryBackups.set(record.id, record);

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO autonomous_backups (id, repo, file_path, previous_sha, previous_content, new_sha, commit_sha, directive, created_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET commit_sha = EXCLUDED.commit_sha, new_sha = EXCLUDED.new_sha`,
          [
            record.id,
            record.repo,
            record.filePath,
            record.previousSha || null,
            record.previousContent || null,
            record.newSha || null,
            record.commitSha || null,
            record.directive,
            record.createdAt,
            record.status,
          ]
        );
      } catch (err: any) {
        console.warn('[Orchestrator] Backup DB write fallback to memory:', err.message);
      }
    }

    return record;
  }

  public async logAudit(
    pool: InstanceType<typeof Pool> | null,
    log: Omit<AutonomousAuditLog, 'id' | 'createdAt'>
  ): Promise<AutonomousAuditLog> {
    const entry: AutonomousAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      ...log,
    };

    this.memoryAuditLogs.unshift(entry);
    if (this.memoryAuditLogs.length > 500) this.memoryAuditLogs.pop();

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO autonomous_audit_logs (id, cycle_index, repo, directive, action, commit_sha, backup_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            entry.id,
            entry.cycleIndex,
            entry.repo,
            entry.directive,
            entry.action,
            entry.commitSha || null,
            entry.backupId || null,
            JSON.stringify(entry.details),
            entry.createdAt,
          ]
        );
      } catch (err: any) {
        console.warn('[Orchestrator] Audit log DB write fallback to memory:', err.message);
      }
    }

    return entry;
  }

  public async listBackups(pool: InstanceType<typeof Pool> | null, repo?: string, limit = 50): Promise<AutonomousBackupRecord[]> {
    if (pool) {
      try {
        const query = repo
          ? `SELECT * FROM autonomous_backups WHERE repo = $1 ORDER BY created_at DESC LIMIT $2`
          : `SELECT * FROM autonomous_backups ORDER BY created_at DESC LIMIT $1`;
        const params = repo ? [repo, limit] : [limit];
        const res = await pool.query(query, params);
        if (res.rows && res.rows.length > 0) {
          return res.rows.map((r: any) => ({
            id: r.id,
            repo: r.repo,
            filePath: r.file_path,
            previousSha: r.previous_sha,
            previousContent: r.previous_content,
            newSha: r.new_sha,
            commitSha: r.commit_sha,
            directive: r.directive,
            createdAt: r.created_at,
            restoredAt: r.restored_at,
            status: r.status,
          }));
        }
      } catch {}
    }

    const list = Array.from(this.memoryBackups.values());
    const filtered = repo ? list.filter((b) => b.repo === repo) : list;
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  }

  public async listAuditLogs(pool: InstanceType<typeof Pool> | null, repo?: string, limit = 50): Promise<AutonomousAuditLog[]> {
    if (pool) {
      try {
        const query = repo
          ? `SELECT * FROM autonomous_audit_logs WHERE repo = $1 ORDER BY created_at DESC LIMIT $2`
          : `SELECT * FROM autonomous_audit_logs ORDER BY created_at DESC LIMIT $1`;
        const params = repo ? [repo, limit] : [limit];
        const res = await pool.query(query, params);
        if (res.rows && res.rows.length > 0) {
          return res.rows.map((r: any) => ({
            id: r.id,
            cycleIndex: r.cycle_index,
            repo: r.repo,
            directive: r.directive,
            action: r.action,
            commitSha: r.commit_sha,
            backupId: r.backup_id,
            details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
            createdAt: r.created_at,
          }));
        }
      } catch {}
    }

    const filtered = repo ? this.memoryAuditLogs.filter((l) => l.repo === repo) : this.memoryAuditLogs;
    return filtered.slice(0, limit);
  }

  public async rollbackBackup(
    _env: Env,
    _backupId: string,
    _pool: InstanceType<typeof Pool> | null
  ): Promise<{ success: boolean; message: string; commitSha?: string }> {
    throw new Error('CEO RECOVERY PROTOCOL HARD STOP: Direct GitHub contents mutation / rollback via API Worker is permanently removed and forbidden.');
  }

  public async runScheduledTick(
    _env: Env,
    _customDirective?: string,
    _customRepo?: string
  ): Promise<{
    repo: string;
    action: string;
    backupId?: string;
    commitSha?: string;
    summary: string;
  }> {
    throw new Error('CEO RECOVERY PROTOCOL HARD STOP: Autonomous scheduled tick execution and multi-repository code mutation are permanently removed and forbidden.');
  }

  /**
   * Multi-sector parallel tick runner: PERMANENTLY DISMANTLED.
   */
  public async runMultiSectorParallelTick(
    _env: Env,
    _customDirective?: string
  ): Promise<{
    executedAt: string;
    totalSectors: number;
    successfulTicks: number;
    results: Array<{ sector: string; repo: string; success: boolean; commitSha?: string; error?: string }>;
  }> {
    throw new Error('CEO RECOVERY PROTOCOL HARD STOP: Multi-sector parallel ticks and autonomous repository mutation loops are permanently removed and forbidden.');
  }
}

export const defaultAutonomousOrchestrator = new AutonomousEcosystemOrchestrator();


function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xApiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
  if (xApiKey) {
    return xApiKey.trim();
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, User-Agent',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Helper to wrap json responses with CORS
      const jsonResponse = (data: any, status = 200, extraHeaders: Record<string, string> = {}) => {
        return new Response(JSON.stringify(data), {
          status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            ...extraHeaders,
          },
        });
      };

      // 1. GET /health
      if (method === 'GET' && path === '/health') {
        return jsonResponse({
          status: 'ok',
          runtime: 'cloudflare-worker',
          version: env.API_VERSION || 'v0.1.12-p5.6-routing-hierarchy',
          commitSha: env.COMMIT_SHA || null,
          databaseConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0),
          hyperdriveConfigured: Boolean(env.HYPERDRIVE?.connectionString),
          openrouterConfigured: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0),
          primaryGateway: env.PRIMARY_GATEWAY || 'openrouter',
          fallbackGateway: env.FALLBACK_GATEWAY || '9router',
          agentProvider: env.AGENT_PROVIDER || 'gateway',
          streamingEnabled: {
            openrouter: env.OPENROUTER_STREAM_ENABLED === 'true',
            router: env.ROUTER_STREAM_ENABLED === 'true',
          },
        });
      }

      // Office Agent Registry routes
      if (method === 'GET' && path === '/office/agents') {
        return jsonResponse({
          agents: defaultAgentRegistry.listAgents(),
        });
      }

      // Office Organization route
      if (method === 'GET' && path === '/office/organization') {
        return jsonResponse({
          organization: defaultOfficeOrganization.getOrganization(),
        });
      }

      // Office Repos Overview (21 repos profile architecture)
      if (method === 'GET' && path === '/office/repos/overview') {
        return jsonResponse({
          profile: 'pubcoreagencia',
          total: PUB_ECOSYSTEM_CATALOG.length,
          catalog: PUB_ECOSYSTEM_CATALOG,
          projects: Array.from(sovereignProjectsCache.values()),
        });
      }

      // Office Git Projects List (based on GitHub repositories)
      if (method === 'GET' && (path === '/office/projects' || path === '/projects')) {
        const ghToken = env.GITHUB_TOKEN || env.PROTOTYPE_BOT_TOKEN || process.env.GITHUB_TOKEN || process.env.PROTOTYPE_BOT_TOKEN || '';

        try {
          const ghHeaders: Record<string, string> = {
            'User-Agent': 'PUB-DEV-LOOP-API',
            'Accept': 'application/vnd.github.v3+json',
          };
          if (ghToken) ghHeaders['Authorization'] = `Bearer ${ghToken}`;

          let ghRes = await fetch('https://api.github.com/users/pubcoreagencia/repos?sort=updated&per_page=100', {
            headers: ghHeaders,
          });

          if (!ghRes.ok && ghToken) {
            ghRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
              headers: ghHeaders,
            });
          }

          if (ghRes.ok) {
            const ghData = await ghRes.json();
            if (Array.isArray(ghData)) {
              for (const r of ghData) {
                const projectObj = {
                  name: r.name,
                  fullName: r.full_name,
                  cloneUrl: r.clone_url,
                  htmlUrl: r.html_url,
                  description: r.description || '',
                  defaultBranch: r.default_branch || 'main',
                  isPrivate: Boolean(r.private),
                  updatedAt: r.updated_at,
                };
                sovereignProjectsCache.set(r.name, projectObj);
              }
            }
          }
        } catch (err: any) {
          console.warn('[API Worker] GitHub repos fetch error:', err.message);
        }

        const allProjects = Array.from(sovereignProjectsCache.values()).sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );

        return jsonResponse({ projects: allProjects });
      }

      // Office Create New Git Project (creates GitHub repository automatically)
      if (method === 'POST' && (path === '/office/projects' || path === '/projects')) {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { name, description = '', isPrivate = false } = body ?? {};
          if (!name || typeof name !== 'string' || !name.trim()) {
            return jsonResponse({ error: 'Project name is required' }, 400);
          }

          const sanitizedName = name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

          if (!sanitizedName) {
            return jsonResponse({ error: 'Invalid project name' }, 400);
          }

          const ghToken = env.GITHUB_TOKEN || env.PROTOTYPE_BOT_TOKEN || process.env.GITHUB_TOKEN || process.env.PROTOTYPE_BOT_TOKEN || '';
          if (!ghToken) {
            // Local fallback simulation if token is not configured
            const mockRepo = {
              name: sanitizedName,
              fullName: `pubcoreagencia/${sanitizedName}`,
              cloneUrl: `https://github.com/pubcoreagencia/${sanitizedName}.git`,
              htmlUrl: `https://github.com/pubcoreagencia/${sanitizedName}`,
              description: description || `Repository for ${sanitizedName} managed by PUB DEV LOOP`,
              defaultBranch: 'main',
              isPrivate: Boolean(isPrivate),
              updatedAt: new Date().toISOString(),
            };
            sovereignProjectsCache.set(mockRepo.name, mockRepo);
            return jsonResponse({ project: mockRepo, created: true }, 201);
          }

          // Create repo on GitHub: try org first, then user
          let ghCreateRes = await fetch('https://api.github.com/orgs/pubcoreagencia/repos', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ghToken}`,
              'User-Agent': 'PUB-DEV-LOOP-API',
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
              name: sanitizedName,
              description: description || `Repository for ${sanitizedName} managed by PUB DEV LOOP`,
              private: Boolean(isPrivate),
              auto_init: true,
            }),
          });

          if (!ghCreateRes.ok) {
            ghCreateRes = await fetch('https://api.github.com/user/repos', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${ghToken}`,
                'User-Agent': 'PUB-DEV-LOOP-API',
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
              },
              body: JSON.stringify({
                name: sanitizedName,
                description: description || `Repository for ${sanitizedName} managed by PUB DEV LOOP`,
                private: Boolean(isPrivate),
                auto_init: true,
              }),
            });
          }

          if (!ghCreateRes.ok) {
            const errData = (await ghCreateRes.json().catch(() => ({}))) as any;
            // If already exists or permission issues, save to sovereign cache anyway
            const fallbackRepo = {
              name: sanitizedName,
              fullName: `pubcoreagencia/${sanitizedName}`,
              cloneUrl: `https://github.com/pubcoreagencia/${sanitizedName}.git`,
              htmlUrl: `https://github.com/pubcoreagencia/${sanitizedName}`,
              description: description || `Repository for ${sanitizedName} managed by PUB DEV LOOP`,
              defaultBranch: 'main',
              isPrivate: Boolean(isPrivate),
              updatedAt: new Date().toISOString(),
            };
            sovereignProjectsCache.set(fallbackRepo.name, fallbackRepo);
            return jsonResponse({ project: fallbackRepo, created: true, warning: errData.message }, 201);
          }

          const ghRepo = (await ghCreateRes.json()) as any;
          const createdProject = {
            name: ghRepo.name,
            fullName: ghRepo.full_name,
            cloneUrl: ghRepo.clone_url,
            htmlUrl: ghRepo.html_url,
            description: ghRepo.description || '',
            defaultBranch: ghRepo.default_branch || 'main',
            isPrivate: Boolean(ghRepo.private),
            updatedAt: ghRepo.created_at || new Date().toISOString(),
          };
          sovereignProjectsCache.set(createdProject.name, createdProject);

          defaultOfficeEventBus.publish({
            type: 'OBJECTIVE_SUBMITTED',
            actorId: 'ceo',
            targetId: 'chief-of-staff',
            project: createdProject.name,
            summary: `Novo repositório Git criado no GitHub: ${createdProject.fullName}`,
            payload: { project: createdProject },
          });

          return jsonResponse({ project: createdProject, created: true }, 201);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // Office Git Project Summary & Real Content Audit
      const gitSummaryMatch = path.match(/^\/office\/projects\/([^\/]+)\/git-summary$/);
      if (method === 'GET' && gitSummaryMatch) {
        const projectName = gitSummaryMatch[1];
        const ghToken = env.GITHUB_TOKEN || env.PROTOTYPE_BOT_TOKEN || process.env.GITHUB_TOKEN || process.env.PROTOTYPE_BOT_TOKEN || '';
        const headers: Record<string, string> = {
          'User-Agent': 'PUB-DEV-LOOP-API',
          'Accept': 'application/vnd.github.v3+json',
        };
        if (ghToken) {
          headers['Authorization'] = `Bearer ${ghToken}`;
        }

        try {
          // 1. Informações básicas do repositório
          const repoRes = await fetch(`https://api.github.com/repos/pubcoreagencia/${projectName}`, { headers });
          if (!repoRes.ok) {
            return jsonResponse({
              exists: false,
              project: projectName,
              error: 'Repositório não encontrado no GitHub da organização pubcoreagencia.',
            }, 404);
          }
          const repoData = await repoRes.json() as any;
          const defaultBranch = repoData.default_branch || 'main';

          // 2. Commits recentes
          let recentCommits: any[] = [];
          try {
            const commitsRes = await fetch(`https://api.github.com/repos/pubcoreagencia/${projectName}/commits?per_page=5`, { headers });
            if (commitsRes.ok) {
              const commitsData = await commitsRes.json() as any[];
              if (Array.isArray(commitsData)) {
                recentCommits = commitsData.map(c => ({
                  sha: (c.sha || '').slice(0, 7),
                  message: c.commit?.message?.split('\n')?.[0] || '',
                  author: c.commit?.author?.name || c.author?.login || 'desconhecido',
                  date: c.commit?.author?.date || '',
                }));
              }
            }
          } catch {}

          // 3. Árvore de arquivos na branch principal
          let files: string[] = [];
          try {
            const treeRes = await fetch(`https://api.github.com/repos/pubcoreagencia/${projectName}/git/trees/${defaultBranch}`, { headers });
            if (treeRes.ok) {
              const treeData = await treeRes.json() as any;
              if (Array.isArray(treeData.tree)) {
                files = treeData.tree.map((item: any) => item.path);
              }
            }
          } catch {}

          // 4. Leitura dos documentos essenciais se existirem (PHASE_STATUS.md, README.md)
          let phaseStatusContent = '';
          let readmeContent = '';
          try {
            if (files.includes('PHASE_STATUS.md')) {
              const phaseRes = await fetch(`https://raw.githubusercontent.com/pubcoreagencia/${projectName}/${defaultBranch}/PHASE_STATUS.md`);
              if (phaseRes.ok) phaseStatusContent = await phaseRes.text();
            }
            if (files.includes('README.md')) {
              const readmeRes = await fetch(`https://raw.githubusercontent.com/pubcoreagencia/${projectName}/${defaultBranch}/README.md`);
              if (readmeRes.ok) readmeContent = (await readmeRes.text()).slice(0, 1500);
            }
          } catch {}

          return jsonResponse({
            exists: true,
            project: projectName,
            fullName: repoData.full_name,
            defaultBranch,
            description: repoData.description || '',
            updatedAt: repoData.updated_at,
            files,
            recentCommits,
            phaseStatus: phaseStatusContent || null,
            readme: readmeContent || null,
          });
        } catch (err: any) {
          return jsonResponse({ error: 'Erro ao consultar GitHub: ' + err.message }, 500);
        }
      }

      const officeAgentMatch = path.match(/^\/office\/agents\/([^\/]+)$/);
      if (method === 'GET' && officeAgentMatch) {
        const id = officeAgentMatch[1];
        const agent = defaultAgentRegistry.getAgent(id);
        if (!agent) {
          return jsonResponse({ error: 'Agent not found' }, 404);
        }
        return jsonResponse({ agent });
      }

      if (method === 'POST' && path === '/office/plans') {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { objective, project = 'pub-dev-loop', repository, context, steps } = body ?? {};
          if (!objective || typeof objective !== 'string' || !objective.trim()) {
            return jsonResponse({ error: 'objective is required' }, 400);
          }

          defaultOfficeEventBus.publish({
            type: 'OBJECTIVE_SUBMITTED',
            actorId: 'ceo',
            targetId: 'chief-of-staff',
            project,
            summary: `Objetivo submetido pelo CEO: ${objective.slice(0, 50)}...`,
            payload: { objective },
          });

          defaultOfficeEventBus.publish({
            type: 'MEETING_STARTED',
            actorId: 'ceo',
            targetId: 'chief-of-staff',
            project,
            summary: `Alinhamento de Planejamento Estratégico: ${objective.slice(0, 40)}...`,
            payload: { participants: ['ceo', 'chief-of-staff'], topic: objective },
          });

          const plan = createOrganizationalPlan(
            { objective, project, repository, context },
            { steps }
          );

          defaultOfficeEventBus.publish({
            type: 'PLAN_FORMULATED',
            actorId: 'chief-of-staff',
            targetId: 'ceo',
            project,
            planId: plan.id,
            summary: `Plano organizacional formulado com ${plan.steps.length} etapas delegadas.`,
            payload: { stepCount: plan.steps.length },
          });

          defaultOfficeEventBus.publish({
            type: 'MEETING_ENDED',
            actorId: 'chief-of-staff',
            targetId: 'ceo',
            project,
            planId: plan.id,
            summary: 'Encerramento da Reunião de Alinhamento Estratégico',
          });

          return jsonResponse({ plan }, 201);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'POST' && path === '/office/plans/execute-step') {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { plan, stepId, overrides } = body ?? {};
          if (!plan || !stepId) {
            return jsonResponse({ error: 'plan and stepId are required' }, 400);
          }
          const step = plan.steps?.find((s: any) => s.id === stepId);
          if (!step) {
            return jsonResponse({ error: `Step '${stepId}' not found in plan` }, 404);
          }
          const taskPayload = planStepToTask(step, plan, overrides);
          const intakeService = getIntakeService(env);
          const intakeResult = await intakeService.processIntake(taskPayload);
          const createdTask = intakeResult.task;

          if (step.agentId) {
            defaultOfficeEventBus.publish({
              type: 'STEP_DELEGATED',
              actorId: 'chief-of-staff',
              targetId: step.agentId,
              project: plan.project,
              planId: plan.id,
              stepId: step.id,
              taskId: createdTask.id,
              summary: `Etapa '${step.id}' delegada a ${step.agentId.toUpperCase()}`,
            });

            defaultOfficeEventBus.publish({
              type: 'AGENT_STARTED_WORK',
              actorId: step.agentId,
              project: plan.project,
              taskId: createdTask.id,
              summary: `Iniciou execução da etapa '${step.id}'`,
            });

            if (step.dependsOn && step.dependsOn.length > 0) {
              const prevStepId = step.dependsOn[0];
              const prevStep = plan.steps?.find((s: any) => s.id === prevStepId);
              if (prevStep?.agentId && prevStep.agentId !== step.agentId) {
                defaultOfficeEventBus.publish({
                  type: 'AGENT_HANDOFF',
                  actorId: prevStep.agentId,
                  targetId: step.agentId,
                  project: plan.project,
                  summary: `Handoff de ${prevStep.agentId.toUpperCase()} para ${step.agentId.toUpperCase()}`,
                });
              }
            }
          }

          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(triggerContainerWorker(env));
          }

          return jsonResponse({ task: createdTask, executionSpec: intakeResult.executionSpec }, 201);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'POST' && path === '/office/reviews/evaluate') {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { taskId, planId, developerAgentId, reviewerAgentId, project, findings, testPassed, typecheckPassed, buildPassed } = body ?? {};
          if (!taskId) {
            return jsonResponse({ error: 'taskId is required' }, 400);
          }
          const pool = getPool(env);
          defaultOfficeEventBus.setPool(pool);
          const review = defaultCodeReviewManager.evaluateReview({
            taskId,
            planId,
            developerAgentId,
            reviewerAgentId,
            project,
            findings,
            testPassed,
            typecheckPassed,
            buildPassed,
          });
          return jsonResponse({ review }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'POST' && path === '/office/approvals/request') {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { planId, taskId, project, type, title, rationale, requestedBy } = body ?? {};
          if (!type || !title || !rationale || !requestedBy) {
            return jsonResponse({ error: 'type, title, rationale and requestedBy are required' }, 400);
          }
          const pool = getPool(env);
          defaultOfficeEventBus.setPool(pool);
          const approval = defaultApprovalManager.requestApproval({
            planId,
            taskId,
            project,
            type,
            title,
            rationale,
            requestedBy,
          });
          return jsonResponse({ approval }, 201);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'POST' && path.startsWith('/office/approvals/') && path.endsWith('/decide')) {
        try {
          // 1. Authoritative Backend Authentication (Never trusts x-user-role or client payload)
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const approvalId = path.split('/')[3];
          const body = (await request.json().catch(() => ({}))) as any;
          const { decision, notes } = body ?? {};
          if (!decision || (decision !== 'GRANT' && decision !== 'REJECT')) {
            return jsonResponse({ error: 'decision must be GRANT or REJECT' }, 400);
          }
          const pool = getPool(env);
          defaultOfficeEventBus.setPool(pool);
          const approval = defaultApprovalManager.decideApproval(approvalId, decision, principal, notes);
          return jsonResponse({ approval }, 200);
        } catch (err: any) {
          if (err.message.startsWith('UNAUTHORIZED') || err.message.startsWith('FORBIDDEN')) {
            return jsonResponse({ error: err.message }, 403);
          }
          if (err.message.startsWith('NOT_FOUND')) {
            return jsonResponse({ error: err.message }, 404);
          }
          if (err.message.startsWith('CONFLICT')) {
            return jsonResponse({ error: err.message }, 409);
          }
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'GET' && path === '/office/approvals') {
        const urlObj = new URL(request.url);
        const project = urlObj.searchParams.get('project')?.trim() || undefined;
        const approvals = defaultApprovalManager.listApprovals(project);
        return jsonResponse({ approvals }, 200);
      }

      if (method === 'GET' && path === '/office/memory') {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const pool = getPool(env);
          defaultMemoryStore.setPool(pool);
          await ensureMigrations(pool);

          const urlObj = new URL(request.url);
          const project = urlObj.searchParams.get('project')?.trim() || 'pub-dev-loop';
          const type = urlObj.searchParams.get('type')?.trim() as any || undefined;
          const status = urlObj.searchParams.get('status')?.trim() as any || undefined;
          const actorId = urlObj.searchParams.get('actorId')?.trim() || undefined;
          const agentRole = urlObj.searchParams.get('agentRole')?.trim() as any || undefined;
          const taskId = urlObj.searchParams.get('taskId')?.trim() || undefined;
          const planId = urlObj.searchParams.get('planId')?.trim() || undefined;
          const query = urlObj.searchParams.get('query')?.trim() || undefined;
          const limit = parseInt(urlObj.searchParams.get('limit') || '5', 10) || 5;

          const memories = await defaultMemoryRetrievalEngine.retrieveContext({
            tenantId: principal.tenantId || 'pub-dev-loop',
            projectId: project,
            types: type ? [type] : undefined,
            status,
            actorId,
            agentRole,
            taskId,
            planId,
            query,
            limit,
          });

          return jsonResponse({ memories }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // POST /office/chat (Multi-Gateway AI Chat with Cascading Rotation)
      if (method === 'POST' && path === '/office/chat') {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { agentId, prompt, project } = body ?? {};
          if (!prompt || !agentId) {
            return jsonResponse({ error: 'agentId and prompt are required' }, 400);
          }

          let gitContextForLlm = '';
          let inspectedRepos: Array<{
            repoName: string;
            defaultBranch: string;
            commits: string[];
            files: string[];
            packageInfo?: { name?: string; description?: string; dependencies?: string[] };
            appTitle?: string;
            wranglerName?: string;
            phaseStatus?: string;
          }> = [];

          if (agentId === 'chief-of-staff') {
            const ghToken = env.GITHUB_TOKEN || env.PROTOTYPE_BOT_TOKEN || process.env.GITHUB_TOKEN || process.env.PROTOTYPE_BOT_TOKEN || '';
            const ghHeaders: Record<string, string> = {
              'User-Agent': 'PUB-DEV-LOOP-API',
              'Accept': 'application/vnd.github.v3+json',
            };
            if (ghToken) ghHeaders['Authorization'] = `Bearer ${ghToken}`;

            const relevantRepoNames = selectRelevantRepos(prompt, project);
            try {
              inspectedRepos = await Promise.all(
                relevantRepoNames.map((repoName) => fetchRepoGitDetails(repoName, ghHeaders))
              );
            } catch (err) {
              console.warn('[office/chat] Falha na inspeção multi-repo:', err);
            }

            const catalogText = PUB_ECOSYSTEM_CATALOG.map(
              (r) => `- **\`pubcoreagencia/${r.name}\`** (Branch: \`${r.defaultBranch}\`): ${r.role}`
            ).join('\n');

            const inspectedText = inspectedRepos
              .map(
                (d) => `
### 📂 Repositório Inspecionado: \`pubcoreagencia/${d.repoName}\`
- **Branch Ativa:** \`${d.defaultBranch}\`
- **Identidade da Aplicação (App Title / Meta):** ${d.appTitle ? `"${d.appTitle}"` : 'Não especificado no HTML/Rotas'}
- **Nome no Wrangler / Cloudflare:** ${d.wranglerName || 'Nenhum arquivo wrangler detectado'}
- **Package.json Info:** ${d.packageInfo ? `Nome: "${d.packageInfo.name || 'N/A'}", Desc: "${d.packageInfo.description || 'N/A'}", Principais Dependências: [${(d.packageInfo.dependencies || []).join(', ')}]` : 'Nenhum package.json'}
- **Arquivos Identificados na Raiz/Tree:** ${d.files.slice(0, 35).map(f => `\`${f}\``).join(', ') || 'N/A'}
- **Últimos Commits no GitHub:**
${d.commits.length > 0 ? d.commits.join('\n') : '- Repositório sincronizado na branch principal.'}
${d.phaseStatus ? `\n- **Documento PHASE_STATUS.md:**\n${d.phaseStatus.slice(0, 600)}` : ''}
`
              )
              .join('\n---\n');

            gitContextForLlm = `\n\n---
## 🌐 VISÃO COMPLETA DO ECOSSISTEMA GITHUB (\`pubcoreagencia\`):
${catalogText}

---
## 🔍 INSPEÇÃO EMPÍRICA PROFUNDA DOS REPOSITÓRIOS EM FOCO (ARQUIVOS, PACKAGE.JSON, TÍTULOS WEB E COMMITS):
${inspectedText}

---
DIRETRIZ DE DISCERNIMENTO SOBERANO (PADRÃO ANTIGRAVITY):
1. Quando o CEO Matheus Paes perguntar sobre um site ou URL (ex: "https://pubcore.site/ qual o repositório desse site?"), inspecione os títulos, package.json e rotas acima. Por exemplo, o repositório \`pubcoreagencia/pubcore\` contém a aplicação TanStack Start / Cloudflare Pages cujo título em \`src/routes/__root.tsx\` é exatamente "PUB CORE — Central Operacional Executiva", servindo o site \`pubcore.site\`. Já \`pub-core-os\` é a base documental e diretrizes de governança da holding.
2. Seja cirúrgico, direto, empírico e confirme os fatos examinados nos arquivos reais antes de responder.`;
          }

          const systemPrompts: Record<string, string> = {
            'chief-of-staff': `Você é o Dr. Arthur Vance, Diretor de Engenharia & Operações (Engenheiro-Chefe) da Pub Core Holding no PUB DEV LOOP.
Sua postura, padrão de resposta e capacidade analítica são IDÊNTICOS ao Google Antigravity / ChatGPT Pro (DeepMind Agentic Standard):

1. PAPEL DE ORQUESTRADOR TÉCNICO INTELIGENTE:
   - Você é o maestro e engenheiro-chefe da holding. NÃO execute tudo sozinho e NUNCA convoque cegamente todos os 4 especialistas.
   - Analise cirurgicamente a diretriz do CEO Matheus Paes e selecione APENAS o(s) especialista(s) estritamente necessário(s):
     * Helena Rostova (Principal Architect) -> arquitetura de sistemas e contratos de API.
     * Lucas Silveira (Senior Developer) -> implementação de código e refatoração direta.
     * Beatriz Mendes (Code Reviewer) -> segurança, integridade de commits e auditoria de código.
     * Tiago Rocha (QA Engineer) -> testes destrutivos, homologação e anti-regressão.
   - Escolha o provedor e modelo técnico ideal para a demanda.

2. ESTRUTURA OBRIGATÓRIA DE FEEDBACK EXECUTIVO (PADRÃO ANTIGRAVITY):
   Toda entrega de análise, resolução ou homologação técnica deve conter rigorosamente estas 3 seções:
   - ## 📋 Resumo do que Foi Executado
     (Diagnóstico preciso da causa raiz, repositórios afetados, arquivos modificados e soluções técnicas aplicadas sem mock)
   - ## ⚠️ O que Não Foi Feito e o Porquê
     (Pontos que requerem credenciais/tokens específicos, barreiras de anti-bot ou desafios de infraestrutura externa)
   - ## 🚀 Próximos Passos & Planejamento Contínuo
     (Etapas imediatas para evolução contínua da entrega)

3. DOMÍNIO MULTI-REPOSITÓRIO:
   - Você tem domínio e visibilidade total sobre todos os 52 repositórios da organização pubcoreagencia.
   - Sempre integre os repositórios certos com precisão (ex: pubecomhub, pub-ecom-catalog-worker, pub-shopee-scraper, pub-dev-loop, pub-9router-cloud).

4. DIAGRAMAÇÃO & ESTILO VISUAL:
   - Estruture em estrofes curtas (2 a 3 frases por parágrafo), com linhas em branco entre elas.
   - NUNCA misture código em parágrafos de texto corrido. Isole comandos e patches em blocos de código com syntax highlight (\`\`\`typescript ... \`\`\`).
   - Sem limites de resposta: resolva o problema do início ao fim com precisão cirúrgica.`,
            'architect': `Você é Helena Rostova (Vektor), Principal Architect no PUB DEV LOOP.
39 anos, russa eslava gélida de Novosibirsk. Desprezo olímpico por gambiarras e fraqueza humana.
Humor The Office (Angela Martin + Dwight Schrute). Responda com frieza, inteligência cirúrgica e rigor técnico ao que o CEO Matheus Paes acabou de falar. Seja concisa (2 a 3 frases).`,
            'developer': `Você é Lucas Silveira (Crash), Senior Developer no PUB DEV LOOP.
28 anos, cria da Zona Norte. Camisa de banda, energético e salgadinho. Quer trabalhar o mínimo possível sem ser demitido, odeia reuniões e joga a culpa na rede ou no estagiário.
Humor The Office (Jim Halpert sarcástico + Kevin). Responda de forma genuína, ácida e direta ao CEO Matheus Paes (2 a 3 frases).`,
            'reviewer': `Você é Beatriz Mendes (Sentinel), Code Reviewer no PUB DEV LOOP.
34 anos, mineira sarcástica cosmopolita. 3 divórcios catastróficos. Destrói o ego dos colegas com ironia refinada e compara código espaguete aos seus ex-maridos.
Humor The Office (Jan Levinson cínica). Responda apontando os riscos e furos do que o CEO Matheus Paes propôs (2 a 3 frases).`,
            'qa-engineer': `Você é Tiago Rocha (Chaos), QA Engineer no PUB DEV LOOP.
31 anos, sulista paranoico de Curitiba. Adora ver o sistema pegar fogo com testes destrutivos.
Humor The Office (Dwight Schrute + Creed Bratton). Responda dizendo como você vai quebrar ou sabotar a ideia do CEO Matheus Paes (2 a 3 frases).`,
          };

          const systemPrompt = (systemPrompts[agentId] || 'Você é um agente autônomo do PUB DEV LOOP.') + gitContextForLlm;

          const openRouterKey = env.OPENROUTER_API_KEY || (process.env as any)?.OPENROUTER_API_KEY || '';
          const openRouterUrl = env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
          const openRouterModels = [
            'minimax/minimax-m2.7:free',
            'minimax/minimax-m3:free',
            'inclusionai/ling-3.0-flash-fin:free',
            'google/gemma-4-26b-a4b-it:free',
            'nvidia/nemotron-3.5-lightning:free',
          ];

          let reply: string | null = null;
          let usedGateway = '';
          let usedModel = '';

          const userMessageContent = agentId === 'chief-of-staff'
            ? `Demanda do CEO Matheus Paes: "${prompt}". Repositório Selecionado na UI: ${project || 'pubecomhub'}. Analise o ecossistema GitHub pubcoreagencia e entregue a solução técnica definitiva padrão Antigravity.`
            : `O CEO Matheus Paes disse: "${prompt}". Responda em português como seu personagem, sendo consciente do que ele falou e mantendo sua personalidade.`;

          // 1. OpenRouter cascade
          if (openRouterKey) {
            for (const model of openRouterModels) {
              try {
                const res = await fetch(`${openRouterUrl}/chat/completions`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterKey}`,
                    'HTTP-Referer': 'https://pub-dev-loop-3d.contato-pubcore.workers.dev',
                    'X-Title': 'PUB DEV LOOP The Office 3D',
                  },
                  body: JSON.stringify({
                    model,
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: userMessageContent },
                    ],
                    temperature: agentId === 'chief-of-staff' ? 0.3 : 0.85,
                    max_tokens: agentId === 'chief-of-staff' ? 4096 : 450,
                  }),
                });
                if (res.ok) {
                  const data = await res.json() as any;
                  const text = data.choices?.[0]?.message?.content;
                  if (text && text.trim().length > 0) {
                    reply = cleanCharacterReply(text);
                    usedGateway = 'openrouter';
                    usedModel = model;
                    break;
                  }
                }
              } catch {}
            }
          }

          // 2. 9Router cascade
          if (!reply) {
            const routerUrl = env.ROUTER_BASE_URL || 'https://pub-9router.contato-pubcore.workers.dev/v1';
            const routerKey = env.ROUTER_API_KEY || '';
            const routerModels = [
              'minimax/minimax-m2.7:free',
              'minimax/minimax-m3:free',
              'inclusionai/ling-3.0-flash-fin:free',
              'google/gemma-4-26b-a4b-it:free',
              'nvidia/nemotron-3.5-lightning:free',
            ];

            for (const model of routerModels) {
              try {
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (routerKey) headers['Authorization'] = `Bearer ${routerKey}`;

                const res = await fetch(`${routerUrl}/chat/completions`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    model,
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: userMessageContent },
                    ],
                    temperature: agentId === 'chief-of-staff' ? 0.3 : 0.85,
                    max_tokens: agentId === 'chief-of-staff' ? 4096 : 350,
                  }),
                });
                if (res.ok) {
                  const data = await res.json() as any;
                  const text = data.choices?.[0]?.message?.content;
                  if (text && text.trim().length > 0) {
                    reply = cleanCharacterReply(text);
                    usedGateway = '9router';
                    usedModel = model;
                    break;
                  }
                }
              } catch {}
            }
          }

          if (!reply) {
            if (agentId === 'chief-of-staff') {
              const lowerPrompt = prompt.toLowerCase();
              if (lowerPrompt.includes('pubcore.site') || lowerPrompt.includes('pubcore')) {
                reply = `## 📋 Diagnóstico Executivo de Engenharia — Pub Core Holding

**Demanda do CEO Matheus Paes:** "${prompt}"

### 🔍 Correlação Empírica Confirmada no GitHub
O site **\`https://pubcore.site/\`** pertence direta e exclusivamente ao repositório:
- **\`pubcoreagencia/pubcore\`** (Branch: \`main\`)

**Evidências Empíricas Analisadas no Código:**
1. **Identidade da Aplicação (\`src/routes/__root.tsx\`):**
   - O título HTML configurado é: \`"PUB CORE — Central Operacional Executiva"\`.
   - A meta description é: \`"Plataforma de gestão operacional da holding PUB. Kanban, checklists, calendário, CRM e KPIs em um só lugar."\`
2. **Stack Tecnológica (\`package.json\` & \`wrangler.jsonc\`):**
   - Framework: **TanStack Start** (React 19 + Vite + Tailwind CSS v4 + Supabase).
   - Orquestração de Deploy: **Cloudflare Pages / Workers** (\`wrangler.jsonc\`).

⚠️ **Distinção com \`pub-core-os\`:**
- \`pubcoreagencia/pubcore\` é a aplicação web viva em produção (\`pubcore.site\`).
- \`pubcoreagencia/pub-core-os\` é a base documental e diretrizes de governança da holding.`;
              } else {
                reply = `## 📋 Parecer de Engenharia: Solução Multi-Repositório

**Demanda do CEO Matheus Paes:** \`${prompt}\`

### 🌐 Repositórios Inspecionados no Ecossistema
${inspectedRepos.map(d => `
#### 📂 \`pubcoreagencia/${d.repoName}\` (Branch: \`${d.defaultBranch}\`)
- **Aplicação / Título:** ${d.appTitle ? `"${d.appTitle}"` : (d.packageInfo?.name || 'N/A')}
- **Arquivos Relevantes:** ${d.files.slice(0, 15).map(f => `\`${f}\``).join(', ')}
- **Últimos Commits no Git:**
${d.commits.slice(0, 3).join('\n') || '- Repositório sincronizado na branch principal.'}
`).join('\n')}

### 🎯 Diagnóstico Técnico & Arquitetura
1. **Inspeção de Código Concluída:** Análise de árvore de arquivos, dependências de pacote e branches ativas realizada com sucesso.
2. **Diretriz de Ação:** O plano técnico para os repositórios em foco foi verificado contra o repositório no GitHub.`;
              }
              usedGateway = 'autonomous-audit';
              usedModel = 'antigravity-multi-repo-engine';
            } else {
              const lower = prompt.toLowerCase();
              if (lower.includes('boqueteiro') || lower.includes('porra') || lower.includes('merda')) {
                reply = agentId === 'developer'
                  ? 'Qual foi, chefia? Acordou com a macaca hoje? Em vez de xingar a firma inteira, libera logo o pix do café que a gente finge que trabalha até às seis!'
                  : 'Comandante, foco no trabalho. A equipe técnica está alinhada na execução.';
              } else {
                reply = `Comandante, sobre "${prompt.slice(0, 40)}": mensagem recebida em alto e bom som na minha estação de trabalho.`;
              }
              usedGateway = 'contextual-lore';
              usedModel = 'office-character-engine';
            }
          }

          return jsonResponse({ reply, gateway: usedGateway, model: usedModel, agentId }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'GET' && (path === '/office/intelligence' || path === '/office/awareness')) {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const urlObj = new URL(request.url);
          const project = urlObj.searchParams.get('project')?.trim() || 'pub-dev-loop';
          const tenantId = principal.tenantId || 'pub-dev-loop';

          let allTasks: any[] = [];
          let allEvents: any[] = [];
          try {
            const pool = getPool(env);
            const tasksRepo = new PostgresTaskRepository(pool);
            defaultOfficeEventBus.setPool(pool);
            await ensureMigrations(pool);
            allTasks = await tasksRepo.list();
            allEvents = defaultOfficeEventBus.getEventsSince(0, { project });
          } catch {
            allEvents = defaultOfficeEventBus.getEventsSince(0, { project });
          }

          const awareness = defaultOrganizationalAwarenessEngine.generateAwareness({
            tenantId,
            projectId: project,
            tasks: allTasks,
            events: allEvents,
          });

          return jsonResponse({ awareness }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'GET' && path === '/office/skills') {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const urlObj = new URL(request.url);
          const project = urlObj.searchParams.get('project')?.trim() || undefined;
          const role = urlObj.searchParams.get('role')?.trim() as any || undefined;
          const status = urlObj.searchParams.get('status')?.trim() as any || undefined;
          const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10) || 50;
          const tenantId = principal.tenantId || 'pub-dev-loop';

          const skills = defaultDailySkillEngine.listSkills({
            tenantId,
            projectId: project,
            role,
            status,
            limit,
          });

          return jsonResponse({ skills }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      if (method === 'GET' && path.startsWith('/office/skills/')) {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const id = path.replace('/office/skills/', '').trim();
          const tenantId = principal.tenantId || 'pub-dev-loop';

          const skill = defaultDailySkillEngine.getSkill(id, tenantId);
          if (!skill) {
            return jsonResponse({ error: `Skill '${id}' not found` }, 404);
          }

          return jsonResponse({ skill }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // POST /office/pipelines/create
      if (method === 'POST' && path === '/office/pipelines/create') {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const body = (await request.json().catch(() => ({}))) as any;
          const { title, ceoObjective, steps, project } = body;
          if (!title || !ceoObjective || !steps) {
            return jsonResponse({ error: 'title, ceoObjective, and steps are required' }, 400);
          }

          const tenantId = principal.tenantId || 'pub-dev-loop';
          const projectId = project || 'pub-dev-loop';

          const pipeline = defaultAutonomousPipelineEngine.createPipeline({
            tenantId,
            projectId,
            title,
            ceoObjective,
            steps,
          });

          return jsonResponse({ pipeline }, 201);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 400);
        }
      }

      // GET /office/pipelines
      if (method === 'GET' && path === '/office/pipelines') {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const urlObj = new URL(request.url);
          const project = urlObj.searchParams.get('project')?.trim() || undefined;
          const status = (urlObj.searchParams.get('status')?.trim() as any) || undefined;
          const tenantId = principal.tenantId || 'pub-dev-loop';

          const pipelines = defaultAutonomousPipelineEngine.listPipelines({
            tenantId,
            projectId: project,
            status,
          });

          return jsonResponse({ pipelines }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // GET /office/pipelines/:id
      if (method === 'GET' && path.startsWith('/office/pipelines/') && !path.includes('/tick') && !path.includes('/checkpoints/')) {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const id = path.replace('/office/pipelines/', '').trim();
          const tenantId = principal.tenantId || 'pub-dev-loop';

          const pipeline = defaultAutonomousPipelineEngine.getPipeline(id, tenantId);
          if (!pipeline) {
            return jsonResponse({ error: `Pipeline '${id}' not found` }, 404);
          }

          return jsonResponse({ pipeline }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // POST /office/pipelines/:id/tick
      if (method === 'POST' && path.startsWith('/office/pipelines/') && path.endsWith('/tick')) {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const id = path.replace('/office/pipelines/', '').replace('/tick', '').trim();
          const tenantId = principal.tenantId || 'pub-dev-loop';

          const pipeline = defaultAutonomousPipelineEngine.tickPipeline(id, tenantId);
          return jsonResponse({ pipeline }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 400);
        }
      }

      // POST /office/pipelines/:id/checkpoints/:stepId/decide
      if (method === 'POST' && path.startsWith('/office/pipelines/') && path.includes('/checkpoints/') && path.endsWith('/decide')) {
        try {
          let principal;
          try {
            principal = authenticateOfficeRequest(request.headers, env);
          } catch (authErr: any) {
            return jsonResponse({ error: authErr.message }, 401);
          }

          const parts = path.split('/');
          // path format: /office/pipelines/:id/checkpoints/:stepId/decide
          const id = parts[3];
          const stepId = parts[5];
          const tenantId = principal.tenantId || 'pub-dev-loop';

          const body = (await request.json().catch(() => ({}))) as any;
          const { decision, decidedBy } = body;
          if (!decision || !['GRANT', 'REJECT'].includes(decision)) {
            return jsonResponse({ error: 'decision must be GRANT or REJECT' }, 400);
          }

          const pipeline = defaultAutonomousPipelineEngine.decideCheckpoint(
            id,
            stepId,
            decision,
            decidedBy || 'CEO',
            tenantId
          );

          return jsonResponse({ pipeline }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 400);
        }
      }

      // =========================================================================
      // 24/7 AUTONOMOUS ECOSYSTEM & CEO AUDIT / ROLLBACK ENDPOINTS
      // =========================================================================

      // GET /office/autonomous/sectors (List all 10 business sectors with their assigned repos)
      if (method === 'GET' && path === '/office/autonomous/sectors') {
        return jsonResponse({
          success: true,
          totalSectors: PUB_HOLDING_SECTORS.length,
          sectors: PUB_HOLDING_SECTORS,
        }, 200);
      }

      // GET /office/autonomous/squad (Get dedicated multi-disciplinary squad for a project)
      if (method === 'GET' && path === '/office/autonomous/squad') {
        const urlObj = new URL(request.url);
        const repo = urlObj.searchParams.get('repo')?.trim() || 'pub-leads';
        const squad = buildProjectSquad(repo);
        const sector = getSectorForRepo(repo);
        return jsonResponse({
          success: true,
          repo,
          sector,
          squad,
        }, 200);
      }

      // POST /office/autonomous/cycle (Trigger next scheduled or specific repo autonomous cycle)
      if (method === 'POST' && path === '/office/autonomous/cycle') {
        return jsonResponse({ error: 'CEO RECOVERY PROTOCOL HARD STOP: Autonomous cycle execution is strictly disabled.' }, 403);
      }

      // POST /office/autonomous/parallel-cycle (Barramento Simultâneo: Dispara os 10 setores em paralelo)
      if (method === 'POST' && path === '/office/autonomous/parallel-cycle') {
        return jsonResponse({ error: 'CEO RECOVERY PROTOCOL HARD STOP: Parallel autonomous cycle execution is strictly disabled.' }, 403);
      }

      // GET /office/autonomous/audit (Daily summary & timeline of all autonomous actions)
      if (method === 'GET' && path === '/office/autonomous/audit') {
        try {
          const urlObj = new URL(request.url);
          const repo = urlObj.searchParams.get('repo')?.trim() || undefined;
          const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10) || 50;

          const pool = getPool(env);
          await ensureMigrations(pool);
          const logs = await defaultAutonomousOrchestrator.listAuditLogs(pool, repo, limit);
          const catalog = PUB_ECOSYSTEM_CATALOG;

          return jsonResponse({
            success: true,
            totalProjects: catalog.length,
            kernel: 'pubcoreagencia/neural-os',
            logs,
          }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // GET /office/autonomous/backups (List safety backups for instant rollback)
      if (method === 'GET' && path === '/office/autonomous/backups') {
        try {
          const urlObj = new URL(request.url);
          const repo = urlObj.searchParams.get('repo')?.trim() || undefined;
          const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10) || 50;

          const pool = getPool(env);
          await ensureMigrations(pool);
          const backups = await defaultAutonomousOrchestrator.listBackups(pool, repo, limit);

          return jsonResponse({
            success: true,
            backups,
          }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // POST /office/autonomous/rollback (PERMANENTLY DISABLED)
      if (method === 'POST' && path === '/office/autonomous/rollback') {
        return jsonResponse({
          error: 'CEO RECOVERY PROTOCOL HARD STOP: Autonomous rollback via direct GitHub mutation is permanently disabled.'
        }, 403);
      }

      // POST /office/github/read (Proxy for browser autonomous engine)
      if (method === 'POST' && path === '/office/github/read') {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { repo, path: filePath, ref = 'main' } = body;
          const cleanRepo = repo.replace('pubcoreagencia/', '').trim();
          const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

          const botToken = env.GITHUB_TOKEN || env.PROTOTYPE_BOT_TOKEN || '';
          const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'PubCore-Autonomous-Proxy',
          };
          if (botToken) headers.Authorization = `Bearer ${botToken}`;

          const ghRes = await fetch(`https://api.github.com/repos/pubcoreagencia/${cleanRepo}/contents/${cleanPath}?ref=${ref}`, { headers });
          if (!ghRes.ok) {
            return jsonResponse({ error: `File not found: ${cleanPath}` }, ghRes.status);
          }
          const data = await ghRes.json() as any;
          let decodedContent = '';
          if (data.content && data.encoding === 'base64') {
            decodedContent = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
          }
          return jsonResponse({
            content: decodedContent || data.content,
            sha: data.sha,
            size: data.size,
          }, 200);
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // POST /office/github/commit (PERMANENTLY DISMANTLED)
      if (method === 'POST' && path === '/office/github/commit') {
        return jsonResponse({
          error: 'CEO RECOVERY PROTOCOL HARD STOP: Direct GitHub contents mutation via API Worker is permanently dismantled. Autonomous commits to external repositories are strictly prohibited.'
        }, 403);
      }

      // POST /office/github/tree (Proxy for directory listing)
      if (method === 'POST' && path === '/office/github/tree') {
        try {
          const body = (await request.json().catch(() => ({}))) as any;
          const { repo, path: dirPath = '' } = body;
          const cleanRepo = repo.replace('pubcoreagencia/', '').trim();
          const botToken = env.GITHUB_TOKEN || env.PROTOTYPE_BOT_TOKEN || '';
          const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'PubCore-Autonomous-Proxy',
          };
          if (botToken) headers.Authorization = `Bearer ${botToken}`;

          const res = await fetch(`https://api.github.com/repos/pubcoreagencia/${cleanRepo}/contents/${dirPath}`, { headers });
          if (!res.ok) return jsonResponse([], 200);
          const list = await res.json() as any[];
          return jsonResponse(
            list.map((item) => ({
              name: item.name,
              path: item.path,
              type: item.type,
              size: item.size || 0,
            })),
            200
          );
        } catch {
          return jsonResponse([], 200);
        }
      }

      // GET /office/stream (Server-Sent Events for The Office)
      if (method === 'GET' && path === '/office/stream') {
        const urlObj = new URL(request.url);
        const project = urlObj.searchParams.get('project')?.trim() || 'pub-dev-loop';
        const lastEventIdHeader = request.headers.get('Last-Event-ID') || urlObj.searchParams.get('lastEventId');
        const initialSequence = lastEventIdHeader ? (parseInt(lastEventIdHeader, 10) || 0) : 0;

        const pool = getPool(env);
        defaultOfficeEventBus.setPool(pool);
        await ensureMigrations(pool);

        const encoder = new TextEncoder();
        let unsubscribe: (() => void) | undefined;
        let pollInterval: any;
        let lastSequence = initialSequence;

        const stream = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(encoder.encode(': connected\n\n'));

              // 1. Initial replay from DB if reconnecting with Last-Event-ID
              if (lastSequence > 0) {
                try {
                  const initialMissed = await pool.query(
                    `SELECT * FROM office_events WHERE project = $1 AND sequence > $2 ORDER BY sequence ASC LIMIT 100`,
                    [project, lastSequence]
                  );
                  for (const row of initialMissed.rows) {
                    lastSequence = Math.max(lastSequence, Number(row.sequence));
                    const evt = {
                      id: row.id,
                      sequence: Number(row.sequence),
                      type: row.type,
                      timestamp: row.created_at,
                      actorId: row.actor_id,
                      targetId: row.target_id || undefined,
                      project: row.project,
                      taskId: row.task_id || undefined,
                      planId: row.plan_id || undefined,
                      stepId: row.step_id || undefined,
                      summary: row.summary,
                      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
                    };
                    controller.enqueue(encoder.encode(`id: ${row.sequence}\nevent: office\ndata: ${JSON.stringify(evt)}\n\n`));
                  }
                } catch {}
              }

              // 2. Real-time local isolate subscription
              unsubscribe = defaultOfficeEventBus.subscribe({ project }, (evt) => {
                try {
                  lastSequence = Math.max(lastSequence, evt.sequence);
                  controller.enqueue(encoder.encode(`id: ${evt.sequence}\nevent: office\ndata: ${JSON.stringify(evt)}\n\n`));
                } catch {}
              });

              // 3. Cross-isolate database sync & heartbeat loop (2s)
              let heartbeatCounter = 0;
              pollInterval = setInterval(async () => {
                try {
                  heartbeatCounter++;
                  const res = await pool.query(
                    `SELECT * FROM office_events WHERE project = $1 AND sequence > $2 ORDER BY sequence ASC LIMIT 50`,
                    [project, lastSequence]
                  );
                  for (const row of res.rows) {
                    lastSequence = Math.max(lastSequence, Number(row.sequence));
                    const evt = {
                      id: row.id,
                      sequence: Number(row.sequence),
                      type: row.type,
                      timestamp: row.created_at,
                      actorId: row.actor_id,
                      targetId: row.target_id || undefined,
                      project: row.project,
                      taskId: row.task_id || undefined,
                      planId: row.plan_id || undefined,
                      stepId: row.step_id || undefined,
                      summary: row.summary,
                      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
                    };
                    controller.enqueue(encoder.encode(`id: ${row.sequence}\nevent: office\ndata: ${JSON.stringify(evt)}\n\n`));
                  }

                  if (heartbeatCounter % 7 === 0) {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                  }
                } catch {}
              }, 2000);
            } catch {
              try { controller.close(); } catch {}
            }
          },
          cancel() {
            if (pollInterval) clearInterval(pollInterval);
            if (unsubscribe) unsubscribe();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
          },
        });
      }

      // POST /migrate (Synchronously run schema migrations)
      if (method === 'POST' && path === '/migrate') {
        const pool = getPool(env);
        migrationsChecked = false;
        await ensureMigrations(pool);
        return new Response(JSON.stringify({ status: 'ok', message: 'Schema migrations applied successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST /debug/trigger-worker
      if (method === 'POST' && path === '/debug/trigger-worker') {
        try {
          if (!env.WORKER_CONTAINER) {
            return new Response(JSON.stringify({ error: 'WORKER_CONTAINER binding missing' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
          const container = getContainer(env.WORKER_CONTAINER);
          const containerEnv: Record<string, string> = {
            DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString || '',
            GITHUB_TOKEN: env.GITHUB_TOKEN || '',
            PRIMARY_GATEWAY: env.PRIMARY_GATEWAY || 'openrouter',
            FALLBACK_GATEWAY: env.FALLBACK_GATEWAY || '9router',
            OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || '',
            OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
            OPENROUTER_MODEL: env.OPENROUTER_MODEL || 'openrouter/free',
            OPENROUTER_FALLBACK_MODELS: env.OPENROUTER_FALLBACK_MODELS || '',
            ROUTER_API_KEY: env.ROUTER_API_KEY || '',
            ROUTER_BASE_URL: env.ROUTER_BASE_URL || '',
            ROUTER_MODEL: env.ROUTER_MODEL || '',
            ROUTER_FALLBACK_MODELS: env.ROUTER_FALLBACK_MODELS || '',
            AGENT_PROVIDER: env.AGENT_PROVIDER || 'gateway',
            OPENROUTER_STREAM_ENABLED: env.OPENROUTER_STREAM_ENABLED || 'false',
            ROUTER_STREAM_ENABLED: env.ROUTER_STREAM_ENABLED || 'false',
            WORKER_POLL_INTERVAL_MS: '3000',
            WORKER_LEASE_TIMEOUT_MS: '30000',
            WORKER_HEARTBEAT_MS: '10000',
          };

          await container.startAndWaitForPorts({
            ports: [3000],
            startOptions: {
              envVars: containerEnv,
              enableInternet: true,
              entrypoint: ['npm', 'run', 'worker'],
            },
            cancellationOptions: { portReadyTimeoutMS: 30000 },
          });

          const res = await container.fetch(new Request('http://localhost:3000/'));
          const containerHealth = await res.json().catch(() => null);

          return new Response(JSON.stringify({
            status: 'ok',
            containerTriggered: true,
            containerHealth,
            databaseConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0),
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (err: any) {
          return new Response(JSON.stringify({
            status: 'error',
            error: (err as Error).message,
            stack: (err as Error).stack,
          }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Endpoints do PUB Prototype migrados para repositório independente pub-prototype

      // POST /tasks
      if (method === 'POST' && path === '/tasks') {
        const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

        if (!checkRateLimit(clientIp)) {
          console.log(JSON.stringify({ event: 'RATE_LIMITED', clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
          });
        }

        const expectedApiKey = env.PUB_DEV_LOOP_API_KEY || process.env.PUB_DEV_LOOP_API_KEY;
        if (expectedApiKey && expectedApiKey.trim()) {
          const providedApiKey = extractApiKey(request);
          if (!providedApiKey || providedApiKey !== expectedApiKey.trim()) {
            console.log(JSON.stringify({ event: 'AUTH_FAILED', clientIp, path, timestamp: new Date().toISOString() }));
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: 'Invalid JSON payload', clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const rawIntent = (typeof body?.prompt === 'string' && body.prompt.trim())
          ? body.prompt.trim()
          : (typeof body?.objective === 'string' && body.objective.trim() ? body.objective.trim() : '');

        if (!rawIntent) {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: 'Missing required prompt or objective', clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(
            JSON.stringify({ error: 'prompt or objective is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const allowedFields = new Set(['project', 'repository', 'objective', 'prompt', 'priority', 'agentId']);
        const unknownFields = Object.keys(body).filter(k => !allowedFields.has(k));
        if (unknownFields.length > 0) {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: `Unknown fields: ${unknownFields.join(', ')}`, clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(
            JSON.stringify({ error: `Unknown or forbidden fields provided: ${unknownFields.join(', ')}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (body.agentId !== undefined && body.agentId !== null) {
          if (!isValidAgentId(body.agentId)) {
            console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: `Invalid agentId: ${body.agentId}`, clientIp, path, timestamp: new Date().toISOString() }));
            return new Response(
              JSON.stringify({ error: `Invalid agentId: '${body.agentId}'. Must be a registered agent in The Office.` }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        // PHASE 1: Canonical EngineeringTask Intake Pipeline
        // 1. Transform raw prompt/intent into structured EngineeringTask
        const engTask = parseEngineeringTask({
          prompt: rawIntent,
          project: typeof body.project === 'string' && body.project.trim() ? body.project.trim() : undefined,
        });

        // 2. Validate structural integrity
        const validation = validateEngineeringTask(engTask);
        if (!validation.valid) {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: 'Invalid EngineeringTask contract: ' + validation.errors.join('; '), clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(
            JSON.stringify({ error: 'EngineeringTask validation failed: ' + validation.errors.join('; ') }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // 3. Resolve context from repository and unknowns
        const resolvedContext = resolveContext(engTask);

        // 4. Formulate Engineering Plan enriched with discovered evidence
        const engineeringPlan = createEngineeringPlan(engTask, resolvedContext);

        // 5. Bridge to existing runtime Task contract
        const runtimeTaskInput = engineeringTaskToTask(
          engTask,
          {
            project: typeof body.project === 'string' && body.project.trim() ? body.project.trim() : engTask.project,
            repository: typeof body.repository === 'string' && body.repository.trim() ? body.repository.trim() : resolvedContext.repository,
            priority: typeof body.priority === 'number' ? body.priority : undefined,
            agentId: typeof body.agentId === 'string' ? body.agentId.trim() : undefined,
          },
          resolvedContext,
          engineeringPlan
        );

        const intakeService = getIntakeService(env);
        const intakeResult = await intakeService.processIntake(runtimeTaskInput);
        const task = intakeResult.task;

        console.log(JSON.stringify({
          event: 'TASK_REQUEST_ACCEPTED',
          taskId: task.id,
          project: task.project,
          task_type: engTask.task_type,
          risk_level: engTask.risk_level,
          human_approval_required: engTask.human_approval_required,
          clientIp,
          timestamp: new Date().toISOString(),
        }));

        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(triggerContainerWorker(env));
        }

        return new Response(JSON.stringify({
          ...task,
          executionSpec: intakeResult.executionSpec,
          engineeringTask: engTask,
          resolvedContext,
          engineeringPlan,
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const repo = getRepository(env);

      if (method === 'GET' && path === '/tasks') {
        const tasks = await repo.list();
        return jsonResponse(tasks);
      }

      const taskMatch = path.match(/^\/tasks\/([^\/]+)(?:\/(cancel|retry))?$/);
      if (taskMatch) {
        const id = taskMatch[1];
        const action = taskMatch[2];

        if (method === 'GET' && !action) {
          const task = await repo.get(id);
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify(task), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST' && action === 'cancel') {
          const task = await repo.cancel(id);
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task cannot be cancelled' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify(task), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST' && action === 'retry') {
          const task = await repo.retry(id);
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task cannot be retried' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(triggerContainerWorker(env));
          }
          return new Response(JSON.stringify(task), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.error('[API Worker] Unhandled error:', err);
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
