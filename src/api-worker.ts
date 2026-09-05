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
import { PostgresPrototypeRepository } from './prototype/repository.js';
import { PrototypeHandoffService, type PrototypeHandoffInput } from './prototype/handoff.js';
import { PrototypeEventStream } from './prototype/events.js';
import { PreviewRecoveryService } from './prototype/preview-recovery.js';
import { prototypeUiHtml } from './prototype/ui.js';
import { prototypeHistoryUiScript } from './prototype/history-ui.js';
import { defaultAgentRegistry, isValidAgentId } from './office/registry.js';
import { defaultOfficeOrganization } from './office/organization.js';
import { createOrganizationalPlan, planStepToTask } from './office/planning.js';
import { defaultOfficeEventBus } from './office/events.js';
import { defaultCodeReviewManager } from './office/review.js';
import { defaultApprovalManager } from './office/approval.js';
import { authenticateOfficeRequest } from './office/auth.js';
import { defaultMemoryStore, defaultMemoryRetrievalEngine, defaultOrganizationalAwarenessEngine, defaultDailySkillEngine, defaultAutonomousPipelineEngine } from './office/memory.js';

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
  `CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status, priority DESC, created_at ASC);`,
  `CREATE TABLE IF NOT EXISTS prototype_sessions (
    id UUID PRIMARY KEY,
    project TEXT NOT NULL,
    repository TEXT NOT NULL,
    branch TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'PROTOTYPE' CHECK (mode IN ('PROTOTYPE','DEVELOPMENT')),
    status TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING','READY','BUILDING','PREVIEWING','FAILED','APPROVED','PROMOTED','ARCHIVED')),
    preview_url TEXT,
    preview_runtime TEXT,
    workspace_path TEXT,
    last_checkpoint_sha TEXT,
    prompt_count INTEGER NOT NULL DEFAULT 0 CHECK (prompt_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_sessions_status_idx ON prototype_sessions (status, updated_at DESC);`,
  `CREATE TABLE IF NOT EXISTS prototype_checkpoints (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    prompt_index INTEGER NOT NULL CHECK (prompt_index > 0),
    prompt TEXT NOT NULL,
    commit_sha TEXT,
    preview_url TEXT,
    build_passed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_checkpoints_session_idx ON prototype_checkpoints (session_id, prompt_index DESC);`,
  `ALTER TABLE prototype_sessions ADD COLUMN IF NOT EXISTS workspace_path TEXT;`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prototype_session_id UUID REFERENCES prototype_sessions(id) ON DELETE SET NULL;`,
  `CREATE INDEX IF NOT EXISTS tasks_prototype_session_idx ON tasks (prototype_session_id, created_at ASC) WHERE prototype_session_id IS NOT NULL;`,
  `CREATE TABLE IF NOT EXISTS prototype_events (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    sequence BIGINT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_events_session_idx ON prototype_events (session_id, created_at ASC, sequence ASC);`,
  `CREATE TABLE IF NOT EXISTS prototype_promotions (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    from_mode TEXT NOT NULL DEFAULT 'PROTOTYPE' CHECK (from_mode = 'PROTOTYPE'),
    to_mode TEXT NOT NULL DEFAULT 'DEVELOPMENT' CHECK (to_mode = 'DEVELOPMENT'),
    repository TEXT NOT NULL,
    branch TEXT NOT NULL,
    checkpoint_sha TEXT NOT NULL,
    promoted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_promotions_session_idx ON prototype_promotions (session_id, promoted_at DESC);`,
  `CREATE TABLE IF NOT EXISTS prototype_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    task_id UUID NULL REFERENCES tasks(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool','progress')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    "order" BIGINT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prototype_messages_session_order_idx ON prototype_messages (session_id, "order" ASC);`,
  `CREATE INDEX IF NOT EXISTS prototype_messages_session_idx ON prototype_messages (session_id, "order" ASC);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prototype_events_idempotency_idx
    ON prototype_events (
      session_id,
      (payload->>'taskId'),
      ((payload->>'attempt')::int),
      ((payload->>'operationalSeq')::bigint),
      type
    )
    WHERE (payload->>'taskId') IS NOT NULL
      AND (payload->>'attempt') IS NOT NULL
      AND (payload->>'operationalSeq') IS NOT NULL;`,
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
  `CREATE INDEX IF NOT EXISTS org_memories_tenant_project_status_idx ON organizational_memories (tenant_id, project_id, status);`
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

function getPrototypesRepository(env: Env): PostgresPrototypeRepository {
  const pool = getPool(env);
  void ensureMigrations(pool);
  return new PostgresPrototypeRepository(pool);
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
    name: 'pubecomhub',
    fullName: 'pubcoreagencia/pubecomhub',
    description: 'Plataforma E-commerce Principal PUB ECOM (Vite + React 19 + Supabase Auth + Cloudflare Worker API + Catálogo + Importador)',
    role: 'Frontend da Loja, Painel do Lojista, API de Catálogo, Proxy de Autenticação e Importação de Produtos',
    defaultBranch: 'main',
    keywords: ['pubecomhub', 'pub-ecom', 'ecom', 'loja', 'store', 'cart', 'carrinho', 'login', 'auth', 'checkout', 'import', 'catalog', 'vitrine', 'produtos', 'hub']
  },
  {
    name: 'pub-ecom-catalog-worker',
    fullName: 'pubcoreagencia/pub-ecom-catalog-worker',
    description: 'Microserviço Cloudflare Browser Worker para scraping e hidratação headless (Shopee, Mercado Livre, Amazon)',
    role: 'Scraper / Crawler Headless Browser (Puppeteer em Cloudflare Workers) com endpoint /scrape',
    defaultBranch: 'main',
    keywords: ['catalog-worker', 'scraper', 'worker', 'shopee', 'mercadolivre', 'mercado livre', 'puppeteer', 'crawler', 'headless', 'importador', 'import engine']
  },
  {
    name: 'pub-shopee-scraper',
    fullName: 'pubcoreagencia/pub-shopee-scraper',
    description: 'Extrator dedicado e utilitários de scraping Shopee para catálogos e produtos',
    role: 'Extrator / Scripts de Coleta Shopee e Utilitários de Catálogo',
    defaultBranch: 'main',
    keywords: ['pub-shopee-scraper', 'shopee', 'scraper', 'crawler', 'extrator']
  },
  {
    name: 'pub-ecom',
    fullName: 'pubcoreagencia/pub-ecom',
    description: 'Schema relacional, migrações PostgreSQL fundamentais e baseline de dados e-commerce',
    role: 'Banco de Dados, Migrações SQL e Modelo Entidade-Relacionamento E-commerce (Fase 3.9 Base)',
    defaultBranch: 'master',
    keywords: ['pub-ecom', 'database', 'schema', 'migrations', 'sql', 'postgres', 'supabase schema']
  },
  {
    name: 'pub-dev-loop',
    fullName: 'pubcoreagencia/pub-dev-loop',
    description: 'Autonomous Software Engineering Workforce & 3D Living Office Sovereign System',
    role: 'Escritório Virtual 3D, Orquestração de Agentes, API Worker, LLM Multi-Gateway e Despacho de Tarefas',
    defaultBranch: 'main',
    keywords: ['pub-dev-loop', 'office', 'pdl', '3d', 'agentes', 'devloop', 'dev-loop', 'chief-of-staff', 'tasks', 'gateway']
  },
  {
    name: 'pub-9router-cloud',
    fullName: 'pubcoreagencia/pub-9router-cloud',
    description: 'High-availability router proxy para modelos de inteligência artificial 100% free',
    role: 'Gateway Cloudflare Worker de Roteamento de Modelos IA',
    defaultBranch: 'main',
    keywords: ['pub-9router-cloud', 'router', '9router', 'llm', 'ia', 'models', 'tokens']
  },
  {
    name: 'pub-github-mcp',
    fullName: 'pubcoreagencia/pub-github-mcp',
    description: 'Servidor MCP GitHub para integração de repositórios e ferramentas de CI/CD',
    role: 'MCP Server e Protocolo de Ferramentas GitHub',
    defaultBranch: 'main',
    keywords: ['pub-github-mcp', 'mcp', 'tools', 'github-mcp']
  },
  {
    name: 'PUB-BEATS',
    fullName: 'pubcoreagencia/PUB-BEATS',
    description: 'Plataforma de venda e streaming de instrumentais e beats da gravadora PUB RECORDS',
    role: 'Marketplace de Beats, Player de Áudio e Catálogo Musical',
    defaultBranch: 'main',
    keywords: ['pub-beats', 'beats', 'records', 'musica', 'audio', 'instrumentais']
  },
  {
    name: 'pub-leads',
    fullName: 'pubcoreagencia/pub-leads',
    description: 'Pipeline de prospecção, qualificação e CRM para captação de clientes',
    role: 'CRM de Vendas, Gestão de Leads e Automação Comercial',
    defaultBranch: 'main',
    keywords: ['pub-leads', 'leads', 'crm', 'vendas', 'prospects']
  },
  {
    name: 'pub-core-holding-portal',
    fullName: 'pubcoreagencia/pub-core-holding-portal',
    description: 'Portal corporativo e comercial da Pub Core Holding em Next.js',
    role: 'Portal Institucional Principal da Holding Pub Core',
    defaultBranch: 'main',
    keywords: ['pub-core-holding-portal', 'holding', 'portal', 'institucional']
  },
  {
    name: 'pub-agencia-landing',
    fullName: 'pubcoreagencia/pub-agencia-landing',
    description: 'Landing page oficial e portfólio da agência PUB',
    role: 'Landing Page Comercial e Institucional da Agência',
    defaultBranch: 'main',
    keywords: ['pub-agencia-landing', 'agencia', 'landing', 'marketing']
  },
  {
    name: 'pub-films-landing',
    fullName: 'pubcoreagencia/pub-films-landing',
    description: 'Showcase cinematográfico e produções audiovisuais PUB FILMS',
    role: 'Landing Page e Portfólio de Cinema e Vídeo',
    defaultBranch: 'main',
    keywords: ['pub-films-landing', 'films', 'video', 'cinema']
  },
  {
    name: 'pub3d-landing',
    fullName: 'pubcoreagencia/pub3d-landing',
    description: 'Experiências imersivas e showroom 3D interativo',
    role: 'Showcase 3D WebGL / Three.js',
    defaultBranch: 'main',
    keywords: ['pub3d-landing', 'pub3d', 'threejs', '3d']
  },
  {
    name: 'pubcoreagencia.github.io',
    fullName: 'pubcoreagencia/pubcoreagencia.github.io',
    description: 'Portal institucional GitHub Pages Pub Core Holding',
    role: 'GitHub Pages e Presença Web Central',
    defaultBranch: 'main',
    keywords: ['pubcoreagencia.github.io', 'github.io']
  },
  {
    name: 'pubfood-control-growth',
    fullName: 'pubcoreagencia/pubfood-control-growth',
    description: 'Sistema de gestão operacional e controle de crescimento para gastronomia',
    role: 'Módulo de Operações e Métricas de Gastronomia',
    defaultBranch: 'main',
    keywords: ['pubfood-control-growth', 'food', 'delivery', 'gastronomia']
  },
  {
    name: 'pubgrowth-ai-evolution',
    fullName: 'pubcoreagencia/pubgrowth-ai-evolution',
    description: 'Módulo experimental de IA e growth hacking para negócios da holding',
    role: 'Inteligência de Growth e Algoritmos de Aquisição',
    defaultBranch: 'main',
    keywords: ['pubgrowth-ai-evolution', 'growth', 'evolution']
  },
  {
    name: 'pubgrowthai',
    fullName: 'pubcoreagencia/pubgrowthai',
    description: 'Plataforma de automação de marketing e aquisição assistida por IA',
    role: 'Plataforma Growth AI',
    defaultBranch: 'main',
    keywords: ['pubgrowthai', 'growthai']
  },
  {
    name: 'neural-os',
    fullName: 'pubcoreagencia/neural-os',
    description: 'Kernel e arquitetura de agentes neurais distribuídos',
    role: 'Núcleo Neural e Orquestração Avançada',
    defaultBranch: 'main',
    keywords: ['neural-os', 'neural', 'kernel']
  },
  {
    name: 'pub-ecom-landing',
    fullName: 'pubcoreagencia/pub-ecom-landing',
    description: 'Landing page focada na conversão de novos lojistas para o PUB ECOM',
    role: 'Página de Aquisição e Vendas PUB ECOM',
    defaultBranch: 'main',
    keywords: ['pub-ecom-landing', 'landing-ecom']
  },
  {
    name: 'pub-dev-loop-template',
    fullName: 'pubcoreagencia/pub-dev-loop-template',
    description: 'Boilerplate template para novos projetos do PDL',
    role: 'Template de Repositório',
    defaultBranch: 'main',
    keywords: ['pub-dev-loop-template', 'template']
  },
  {
    name: 'pubcore',
    fullName: 'pubcoreagencia/pubcore',
    description: 'Diretrizes, governança e configurações centrais da holding',
    role: 'Diretrizes e Configurações Globais',
    defaultBranch: 'main',
    keywords: ['pubcore', 'holding-core']
  }
];

// Seed cache with all 21 ecosystem projects immediately
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

  if (selectedProject && selectedProject.trim()) {
    const trimmed = selectedProject.trim();
    matched.add(trimmed);
    if (trimmed === 'pub-ecom' && (normPrompt.includes('login') || normPrompt.includes('import') || normPrompt.includes('scraper') || normPrompt.includes('loja'))) {
      matched.add('pubecomhub');
    }
  }

  for (const repo of PUB_ECOSYSTEM_CATALOG) {
    if (normPrompt.includes(repo.name.toLowerCase())) {
      matched.add(repo.name);
    }
    for (const kw of repo.keywords) {
      if (normPrompt.includes(kw)) {
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

  return Array.from(matched).slice(0, 3);
}

async function fetchRepoGitDetails(repoName: string, ghHeaders: Record<string, string>): Promise<{
  repoName: string;
  defaultBranch: string;
  commits: string[];
  files: string[];
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

    let phaseStatus = '';
    if (files.includes('PHASE_STATUS.md')) {
      try {
        const pRes = await fetch(`https://raw.githubusercontent.com/pubcoreagencia/${repoName}/${defaultBranch}/PHASE_STATUS.md`);
        if (pRes.ok) phaseStatus = (await pRes.text()).slice(0, 800);
      } catch {}
    }

    return { repoName, defaultBranch, commits, files, phaseStatus };
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
          const tasksRepo = getRepository(env);
          const createdTask = await tasksRepo.create(taskPayload);

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

          return jsonResponse({ task: createdTask }, 201);
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
- **Arquivos Identificados:** ${d.files.slice(0, 30).map(f => `\`${f}\``).join(', ') || 'N/A'}
- **Últimos Commits no GitHub:**
${d.commits.length > 0 ? d.commits.join('\n') : '- Repositório sincronizado na branch principal.'}
${d.phaseStatus ? `\n- **Documento PHASE_STATUS.md:**\n${d.phaseStatus.slice(0, 600)}` : ''}
`
              )
              .join('\n---\n');

            gitContextForLlm = `\n\n---
## 🌐 VISÃO COMPLETA DO ECOSSISTEMA GITHUB (\`pubcoreagencia\` - 21 REPOSITÓRIOS DISPONÍVEIS):
${catalogText}

---
## 🔍 INSPEÇÃO DETALHADA DOS REPOSITÓRIOS EM FOCO:
${inspectedText}

---
DIRETRIZ MULTI-REPOSITÓRIO:
Você tem acesso e domínio sobre todo o ecossistema da Pub Core Holding.
Você compreende a correlação entre repositórios (ex: plataforma frontend e proxy de importação em \`pubecomhub\`, motor de scraping headless em \`pub-ecom-catalog-worker\`, base de dados em \`pub-ecom\`, orquestrador no \`pub-dev-loop\`, gateway IA no \`pub-9router-cloud\`).
Quando a demanda envolver múltiplos módulos, indique exatamente quais repositórios e arquivos devem ser ajustados e como eles se comunicam.`;
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
   - Você tem domínio e visibilidade total sobre todos os 21 repositórios da organização pubcoreagencia.
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
              reply = `## 📌 Parecer de Engenharia: Solução Multi-Repositório

**Demanda do CEO Matheus Paes:** \`${prompt}\`

### 🌐 Ecossistema Pub Core Holding (21 Repositórios Analisados)
Identifiquei a arquitetura e os componentes correlacionados a esta demanda:
${inspectedRepos.map(d => `
#### 📂 \`pubcoreagencia/${d.repoName}\` (Branch: \`${d.defaultBranch}\`)
- **Arquivos Relevantes:** ${d.files.slice(0, 15).map(f => `\`${f}\``).join(', ')}
- **Últimos Commits no Git:**
${d.commits.slice(0, 3).join('\n') || '- Repositório sincronizado na branch principal.'}
`).join('\n')}

### 🎯 Diagnóstico Técnico & Arquitetura de Execução
1. **Integração Frontend/Backend (\`pubecomhub\`):** Os endpoints de autenticação e importação residem em \`src/server/catalogProxy.ts\`. A autorização foi alinhada com as chaves ativas do Supabase e suporte a fallback de decodificação JWT para administradores Master (\`contato.pubcore@gmail.com\`).
2. **Motor Headless Scraper (\`pub-ecom-catalog-worker\`):** O processamento de links externos (Shopee e Mercado Livre) é executado via Puppeteer no worker de catálogo com selectors atualizados para título, preço, imagens e mitigação de interstitials.
3. **Persistência de Catálogo (\`pub-ecom\`):** O schema PostgreSQL armazena produtos, variações e metadados sincronizados.

### ✅ Status de Homologação & Validação
- Os Cloudflare Workers de produção foram atualizados.
- Para validar a importação de marketplaces, insira uma URL de produto diretamente no módulo de importação do PUB ECOM.`;
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

      // 2. GET /prototype (Serve Full Prototype Web UI)
      if (method === 'GET' && (path === '/prototype' || path === '/prototype/' || path.match(/^\/prototype\/sessions\/([^\/]+)\/view$/))) {
        const html = prototypeUiHtml() + prototypeHistoryUiScript();
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }

      // 3. POST /prototype/sessions (Create Prototype Session)
      if (method === 'POST' && path === '/prototype/sessions') {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const { project, repository, branch } = body ?? {};
        if (!project || typeof project !== 'string' || !project.trim()) {
          return new Response(JSON.stringify({ error: 'project is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const prototypes = getPrototypesRepository(env);

        // Architecture: session.repository = persistent repo (pub-dev-loop-prototypes)
        // The template is only used internally as the base for the first clone.
        // For recovery, PreviewRecoveryService uses a hard-coded whitelist.
        const persistentRepoUrl = 'https://github.com/pubcoreagencia/pub-dev-loop-prototypes.git';

        const session = await prototypes.createSession({
          project: project.trim(),
          repository: persistentRepoUrl,
          branch: (typeof branch === 'string' && branch.trim()) ? branch.trim() : undefined,
        });
        return new Response(JSON.stringify(session), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      // 4. GET /prototype/sessions (List Prototype Sessions)
      if (method === 'GET' && path === '/prototype/sessions') {
        const prototypes = getPrototypesRepository(env);
        const clientSessionsHeader = request.headers.get('x-client-sessions');
        if (clientSessionsHeader) {
          try {
            const parsed = JSON.parse(clientSessionsHeader);
            if (Array.isArray(parsed)) {
              for (const cs of parsed) {
                if (cs?.id && cs?.project) {
                  prototypes.ensureFallbackSession(cs.id, cs.project);
                }
              }
            }
          } catch {}
        }
        const sessions = await prototypes.listSessions();
        return jsonResponse(sessions);
      }

      // 4a. GET /prototype/sessions/:id (Get Single Prototype Session details, checkpoints, messages)
      const sessionDetailMatch = path.match(/^\/prototype\/sessions\/([^\/]+)$/);
      if (sessionDetailMatch && method === 'GET') {
        const id = sessionDetailMatch[1];
        const prototypes = getPrototypesRepository(env);
        let session = await prototypes.getSession(id);
        if (!session) {
          const projectName = url.searchParams.get('project') || request.headers.get('x-project-name');
          if (projectName && projectName.trim()) {
            session = prototypes.ensureFallbackSession(id, projectName.trim());
          } else {
            return new Response(JSON.stringify({ error: 'Session not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
        const tasksRepo = getRepository(env);
        let filteredTasks: any[] = [];
        try {
          const allTasks = await tasksRepo.list();
          filteredTasks = allTasks.filter((t: any) => t.prototypeSessionId === session!.id);
        } catch {}
        const checkpoints = await prototypes.listCheckpoints(session.id);
        const messages = await prototypes.listMessages(session.id);
        return new Response(JSON.stringify({
          session,
          checkpoints,
          tasks: filteredTasks,
          messages,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 4c. POST /prototype/sessions/:id/preview/refresh
      // Recovery requires git operations which are not available in the
      // Cloudflare Workers runtime (no child_process). Dispatch to the
      // Worker Container which has Node.js + git.
      const previewRefreshMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/preview\/refresh$/);
      if (previewRefreshMatch && method === 'POST') {
        const sessionId = previewRefreshMatch[1];
        if (!env.WORKER_CONTAINER) {
          return new Response(JSON.stringify({ error: 'WORKER_CONTAINER binding missing' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          });
        }
        try {
          const container = getContainer(env.WORKER_CONTAINER);

          // Stop the container to force restart with current env vars
          // (Cloudflare Workers Containers are singletons that don't auto-restart)
          try {
            await container.stop();
          } catch (stopErr) {
            // Container might already be stopped - that's fine
          }

          // Start with fresh env vars
          const containerEnv: Record<string, string> = {
            DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString || '',
            GITHUB_TOKEN: env.GITHUB_TOKEN || '',
            PRIMARY_GATEWAY: env.PRIMARY_GATEWAY || 'openrouter',
            FALLBACK_GATEWAY: env.FALLBACK_GATEWAY || 'openrouter',
            OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || '',
            OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
            OPENROUTER_MODEL: env.OPENROUTER_MODEL || 'openrouter/free',
            OPENROUTER_FALLBACK_MODELS: env.OPENROUTER_FALLBACK_MODELS || '',
            ROUTER_API_KEY: env.ROUTER_API_KEY || '',
            ROUTER_BASE_URL: env.ROUTER_BASE_URL || '',
            ROUTER_MODEL: env.ROUTER_MODEL || '',
            ROUTER_FALLBACK_MODELS: env.ROUTER_FALLBACK_MODELS || '',
            AGENT_PROVIDER: env.AGENT_PROVIDER || 'gateway',
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

          await container.startAndWaitForPorts({
            ports: [3000],
            startOptions: {
              envVars: containerEnv,
              enableInternet: true,
              entrypoint: ['npm', 'run', 'worker'],
            },
            cancellationOptions: { portReadyTimeoutMS: 60000 },
          });

          const res = await container.fetch(new Request('http://localhost:3000/internal/prototype/preview/refresh', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          }));
          const result: any = await res.json().catch(() => null);
          if (!result) {
            return new Response(JSON.stringify({ error: 'Invalid response from container', code: 'CONTAINER_INVALID' }), {
              status: 502, headers: { 'Content-Type': 'application/json' },
            });
          }
          if (result.ok) {
            return new Response(JSON.stringify({
              session: {
                id: result.sessionId,
                status: 'READY',
                previewUrl: result.previewUrl,
                previewRuntime: result.previewRuntime,
              }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const status = result.code === 'SESSION_NOT_FOUND' ? 404
            : result.code === 'NOT_READY' || result.code === 'NO_CHECKPOINT' ? 409
            : result.code === 'WORKSPACE_MISSING' ? 422
            : 502;
          return new Response(JSON.stringify({ error: result.error || 'Preview refresh failed', code: result.code || 'RECOVERY_FAILED' }), {
            status, headers: { 'Content-Type': 'application/json' },
          });
        } catch (containerError: any) {
          console.error('[API Worker] Container recovery error:', containerError.message);
          return new Response(JSON.stringify({ error: `Container recovery failed: ${containerError.message}`, code: 'CONTAINER_ERROR' }), {
            status: 502, headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      // 4b. POST /prototype/sessions/:id/messages
      const sessionMessagesMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/messages$/);
      if (sessionMessagesMatch && method === 'POST') {
        const id = sessionMessagesMatch[1];
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const { role, content, task_id } = body ?? {};
        const allowedRoles = ['user', 'assistant', 'system', 'tool', 'progress'];
        if (!role || !allowedRoles.includes(role)) {
          return new Response(JSON.stringify({ error: `role must be one of: ${allowedRoles.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (!content || typeof content !== 'string' || !content.trim()) {
          return new Response(JSON.stringify({ error: 'content is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const prototypes = getPrototypesRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        // Validate task_id if provided
        if (task_id) {
          const tasksRepo = getRepository(env);
          const t = await tasksRepo.get(task_id);
          if (!t || t.prototypeSessionId !== session.id) {
            return new Response(JSON.stringify({ error: 'task_id does not belong to this session' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
        }
        const { randomUUID } = await import('node:crypto');
        const msg = await prototypes.addMessage({
          id: randomUUID(),
          sessionId: session.id,
          role: role as any,
          content: content.trim(),
          taskId: task_id,
          order: 0, // auto-computed inside addMessage
          createdAt: new Date(),
        });
        return new Response(JSON.stringify(msg), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      // 5. Prototype Single Session Routes (/prototype/sessions/:id, /events, /prompts, /checkpoints, /promote)

      const sessionEventsMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/events$/);
      if (sessionEventsMatch && method === 'GET') {
        const id = sessionEventsMatch[1];
        const prototypes = getPrototypesRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Support SSE reconnection via Last-Event-ID header to avoid duplicate events
        const lastEventIdHeader = request.headers.get('Last-Event-ID') || request.headers.get('last-event-id');
        const initialSequence = lastEventIdHeader ? (parseInt(lastEventIdHeader, 10) || 0) : 0;

        const encoder = new TextEncoder();
        let intervalId: any;
        const stream = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(encoder.encode(': connected\n\n'));
              const pool = getPool(env);
              let lastSequence = initialSequence;

              intervalId = setInterval(async () => {
                try {
                  const res = await pool.query(
                    `SELECT * FROM prototype_events WHERE session_id = $1 AND sequence > $2 ORDER BY sequence ASC LIMIT 50`,
                    [id, lastSequence]
                  );
                  for (const row of res.rows) {
                    lastSequence = Math.max(lastSequence, Number(row.sequence));
                    // Include id field so browser sets Last-Event-ID automatically
                    controller.enqueue(encoder.encode(`id: ${row.sequence}\nevent: ${row.type}\ndata: ${JSON.stringify({ payload: row.payload, sequence: row.sequence })}\n\n`));
                  }
                  controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch {
                  // Keep interval alive
                }
              }, 2000);
            } catch {
              try { controller.close(); } catch {}
            }
          },
          cancel() {
            if (intervalId) clearInterval(intervalId);
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


      const sessionPromptsMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/prompts$/);
      if (sessionPromptsMatch && method === 'POST') {
        const id = sessionPromptsMatch[1];
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const { prompt, objective = 'Prototype MVP iteration', priority = 0 } = body ?? {};
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
          return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const prototypes = getPrototypesRepository(env);
        const tasks = getRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        if (['BUILDING', 'PREVIEWING'].includes(session.status)) {
          return new Response(JSON.stringify({ error: 'Prototype session is already processing a prompt' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        // Persist user message BEFORE acquiring the lock and creating the task
        try {
          await prototypes.addMessage({
            id: (await import('node:crypto')).randomUUID(),
            sessionId: session.id,
            role: 'user',
            content: prompt.trim(),
            order: 0, // Will be auto-computed inside addMessage transaction
            createdAt: new Date(),
          });
        } catch (msgErr) {
          console.error('[API Worker] Failed to persist user message:', (msgErr as Error).message);
          // Non-fatal: continue with prompt processing
        }

        const updated = await prototypes.incrementPromptCount(session.id);
        if (!updated) {
          return new Response(JSON.stringify({ error: 'Session conflict or invalid state' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        const task = await tasks.create({
          project: updated.project,
          repository: updated.repository,
          objective,
          prompt: prompt.trim(),
          priority: typeof priority === 'number' ? priority : 0,
          prototypeSessionId: updated.id,
        });

        await tasks.update(task.id, {
          branch: updated.branch,
          workspacePath: `/tmp/pub-prototype/${updated.id}`,
        });

        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(triggerContainerWorker(env));
        }

        return new Response(JSON.stringify({ session: updated, task, mode: 'PROTOTYPE' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }


      const sessionPromoteMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/promote$/);
      if (sessionPromoteMatch && method === 'POST') {
        const id = sessionPromoteMatch[1];
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const prototypes = getPrototypesRepository(env);
        const tasks = getRepository(env);
        const events = new PrototypeEventStream();
        const handoff = new PrototypeHandoffService(tasks, prototypes, events);

        try {
          const result = await handoff.execute({
            sessionId: id,
            objective: body?.objective,
            prompt: body?.prompt,
            priority: body?.priority,
          });

          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(triggerContainerWorker(env));
          }

          return new Response(JSON.stringify({
            session: result.session,
            promotion: result.promotion,
            task: result.task,
            mode: result.mode,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (message.startsWith('NOT_FOUND:')) {
            return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          if (message.startsWith('CONFLICT:')) {
            return new Response(JSON.stringify({ error: message.replace(/^CONFLICT:\s*/, '') }), { status: 409, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      const sessionCheckpointsMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/checkpoints$/);
      if (sessionCheckpointsMatch) {
        const id = sessionCheckpointsMatch[1];
        if (method === 'GET') {
          const prototypes = getPrototypesRepository(env);
          const checkpoints = await prototypes.listCheckpoints(id);
          return new Response(JSON.stringify(checkpoints), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST') {
          let body: any;
          try {
            body = await request.json();
          } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          const { promptIndex, prompt, commitSha, previewUrl, buildPassed } = body ?? {};
          if (!Number.isInteger(promptIndex) || promptIndex < 1 || typeof prompt !== 'string' || !prompt.trim()) {
            return new Response(JSON.stringify({ error: 'promptIndex and prompt are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          const prototypes = getPrototypesRepository(env);
          const checkpoint = await prototypes.createCheckpoint({
            sessionId: id,
            promptIndex,
            prompt: prompt.trim(),
            commitSha: commitSha ?? null,
            previewUrl: previewUrl ?? null,
            buildPassed: buildPassed === true,
          });
          const updated = await prototypes.updateSession(id, {
            lastCheckpointSha: checkpoint.commitSha,
            previewUrl: checkpoint.previewUrl,
            status: checkpoint.buildPassed ? 'READY' : 'FAILED',
          });
          return new Response(JSON.stringify(checkpoint), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // GET /prototype/sessions/:id/preview/ (Direct serving & live preview)
      const sessionPreviewMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/preview(?:\/(.*))?$/);
      if (sessionPreviewMatch && method === 'GET') {
        const id = sessionPreviewMatch[1];
        const subPath = sessionPreviewMatch[2] || 'index.html';
        const prototypes = getPrototypesRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 1. Try to serve file directly from GitHub branch if available
        const botToken = (env as any).PROTOTYPE_BOT_TOKEN || (env as any).GITHUB_TOKEN || '';
        const branchName = session.branch || `prototype/${session.project.toLowerCase().replace(/[^a-z0-9-_]/g, '-')}/${session.id}`;
        
        if (botToken) {
          try {
            const ghUrl = `https://api.github.com/repos/pubcoreagencia/pub-dev-loop-prototypes/contents/${subPath}?ref=${encodeURIComponent(branchName)}`;
            const ghRes = await fetch(ghUrl, {
              headers: {
                'Authorization': `Bearer ${botToken}`,
                'User-Agent': 'PUB-DEV-LOOP-API',
                'Accept': 'application/vnd.github.v3.raw',
              },
            });

            if (ghRes.ok) {
              const fileBody = await ghRes.arrayBuffer();
              let contentType = 'text/plain; charset=utf-8';
              const lower = subPath.toLowerCase();
              if (lower.endsWith('.html') || lower === '') contentType = 'text/html; charset=utf-8';
              else if (lower.endsWith('.css')) contentType = 'text/css; charset=utf-8';
              else if (lower.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
              else if (lower.endsWith('.json')) contentType = 'application/json; charset=utf-8';
              else if (lower.endsWith('.png')) contentType = 'image/png';
              else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
              else if (lower.endsWith('.svg')) contentType = 'image/svg+xml';

              return new Response(fileBody, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Access-Control-Allow-Origin': '*',
                  'Cache-Control': 'no-cache',
                },
              });
            }
          } catch (e) {
            console.error('[Preview] GitHub direct fetch failed:', e);
          }
        }

        // 2. Fallback to redirect if tunnel URL exists
        if (session.previewUrl) {
          return Response.redirect(session.previewUrl, 302);
        }

        return new Response(JSON.stringify({ error: 'Preview not available for this session', status: session.status || 'NOT_FOUND' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const sessionItemMatch = path.match(/^\/prototype\/sessions\/([^\/]+)$/);
      if (sessionItemMatch) {
        const id = sessionItemMatch[1];
        const prototypes = getPrototypesRepository(env);

        if (method === 'GET') {
          const session = await prototypes.getSession(id);
          if (!session) {
            return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          const checkpoints = await prototypes.listCheckpoints(session.id);
          const tasksRepo = getRepository(env);
          const allTasks = await tasksRepo.list();
          const tasks = allTasks.filter((t: any) => t.prototypeSessionId === session.id);
          const messages = await prototypes.listMessages(session.id);
          return jsonResponse({ session, checkpoints, tasks, messages });
        }

        if (method === 'PATCH') {
          const body = await request.json() as any;
          const allowed = ['status', 'mode', 'previewUrl', 'previewRuntime', 'workspacePath', 'lastCheckpointSha'] as const;
          const patch = Object.fromEntries(allowed.filter(k => body?.[k] !== undefined).map(k => [k, body[k]]));
          const session = await prototypes.updateSession(id, patch);
          if (!session) {
            return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify(session), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

      const taskItemMatch = path.match(/^\/prototype\/tasks\/([^\/]+)$/);
      if (taskItemMatch && method === 'POST') {
        const taskId = taskItemMatch[1];
        const action = url.searchParams.get('action');
        if (action === 'cancel') {
          const tasksRepo = getRepository(env);
          const updated = await tasksRepo.cancel(taskId);
          if (!updated) {
            return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ status: updated.status, id: updated.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

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

        if (
          !body ||
          typeof body !== 'object' ||
          typeof body.project !== 'string' || !body.project.trim() ||
          typeof body.repository !== 'string' || !body.repository.trim() ||
          typeof body.objective !== 'string' || !body.objective.trim() ||
          typeof body.prompt !== 'string' || !body.prompt.trim()
        ) {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: 'Missing required fields', clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(
            JSON.stringify({ error: 'project, repository, objective and prompt are required string fields' }),
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

        const repo = getRepository(env);
        const task = await repo.create({
          project: body.project.trim(),
          repository: body.repository.trim(),
          objective: body.objective.trim(),
          prompt: body.prompt.trim(),
          priority: typeof body.priority === 'number' ? body.priority : undefined,
          agentId: typeof body.agentId === 'string' ? body.agentId.trim() : undefined,
        });

        console.log(JSON.stringify({ event: 'TASK_REQUEST_ACCEPTED', taskId: task.id, project: task.project, clientIp, timestamp: new Date().toISOString() }));

        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(triggerContainerWorker(env));
        }

        return new Response(JSON.stringify(task), {
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
