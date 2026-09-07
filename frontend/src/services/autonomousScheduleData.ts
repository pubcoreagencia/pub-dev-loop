export interface ScheduledProject {
  name: string;
  fullName: string;
  stage: 'ONLINE' | 'DEV' | 'IDEA';
  priority: 'P0' | 'P1' | 'P2';
  cadence: string;
  ownerAgent:
    | 'chief-of-staff'
    | 'architect'
    | 'developer'
    | 'reviewer'
    | 'qa-engineer'
    | 'video-editor'
    | 'image-designer'
    | 'sound-engineer'
    | 'growth-ops';
  description: string | null;
  currentTask: string;
}

export interface ShiftInfo {
  id: string;
  name: string;
  timeRange: string;
  focus: string;
  leadAgents: string[];
  description: string;
}

export const OFFICE_SHIFTS: ShiftInfo[] = [
  {
    id: 'madrugada',
    name: 'Turno 1: Madrugada',
    timeRange: '00:00 – 06:00',
    focus: 'Auditoria Noturna, Infraestrutura, Backups & Regressão QA',
    leadAgents: ['qa-engineer', 'architect'],
    description: 'Testes de regressão, integridade dos 52 repositórios, backups SHA-256 e compactação de dependências.',
  },
  {
    id: 'manha',
    name: 'Turno 2: Manhã',
    timeRange: '06:00 – 12:00',
    focus: 'Core Engines, Plataformas Críticas (P0) & Growth Ops',
    leadAgents: ['chief-of-staff', 'developer', 'growth-ops'],
    description: 'Sprints de código no pubcore, pub-core-os, pub-ecom e neural-os. Prospecção ativa de leads e funil B2B.',
  },
  {
    id: 'tarde',
    name: 'Turno 3: Tarde',
    timeRange: '12:00 – 18:00',
    focus: 'Multimídia, Cinema Drone, Áudio Lab, Render 3D & E-commerce (P1)',
    leadAgents: ['developer', 'video-editor', 'image-designer', 'sound-engineer', 'reviewer'],
    description: 'Edição de tomadas 4K em buzios-de-cima, produção musical em xp-audio-lab e pub-records, esculturas 3D em eternize-seu-pinscher e pub-3d.',
  },
  {
    id: 'noite',
    name: 'Turno 4: Noite',
    timeRange: '18:00 – 24:00',
    focus: 'Landings, Incubação (P2), Segurança & Relatório Executivo do CEO',
    leadAgents: ['chief-of-staff', 'developer', 'reviewer', 'qa-engineer', 'growth-ops'],
    description: 'Otimização de SEO, conversão de landing pages, code review rigoroso e consolidação executiva diária.',
  },
];

export const SCHEDULED_PROJECTS: ScheduledProject[] = [
  {
    "name": "buzios-de-cima",
    "fullName": "pubcoreagencia/buzios-de-cima",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "video-editor",
    "description": "Empreendimento turístico e residencial boutique em Armação dos Búzios.",
    "currentTask": "Processar tomadas aéreas 4K de drone e timeline do teaser"
  },
  {
    "name": "eternize-seu-pinscher",
    "fullName": "pubcoreagencia/eternize-seu-pinscher",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "image-designer",
    "description": "Loja e marca de nicho de personalização afetiva de memorabilia canina.",
    "currentTask": "Auditar malha STL de pinscher e fatiamento 3D para impressão"
  },
  {
    "name": "ia-pubcrypto",
    "fullName": "pubcoreagencia/ia-pubcrypto",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "reviewer",
    "description": "Agente preditivo de análise on-chain e inteligência de mercado cripto.",
    "currentTask": "Manutenção autônoma e sincronização contínua de ia-pubcrypto"
  },
  {
    "name": "leadcore",
    "fullName": "pubcoreagencia/leadcore",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "growth-ops",
    "description": "Core de inteligência e base unificada de contatos e CRM B2B.",
    "currentTask": "Validar base unificada de CRM e automações de prospecção"
  },
  {
    "name": "neural-os",
    "fullName": "pubcoreagencia/neural-os",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "architect",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de neural-os"
  },
  {
    "name": "pub-3d",
    "fullName": "pubcoreagencia/pub-3d",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "image-designer",
    "description": "Experiências imersivas 3D, WebGL e metaversos corporativos.",
    "currentTask": "Otimizar buffers de vértices WebGL e iluminação volumétrica"
  },
  {
    "name": "pub-9router-cloud",
    "fullName": "pubcoreagencia/pub-9router-cloud",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "architect",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-9router-cloud"
  },
  {
    "name": "pub-agencia-landing",
    "fullName": "pubcoreagencia/pub-agencia-landing",
    "stage": "ONLINE",
    "priority": "P1",
    "cadence": "DAILY_MORNING",
    "ownerAgent": "developer",
    "description": "Landing page oficial da agência PUB.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-agencia-landing"
  },
  {
    "name": "PUB-BEATS",
    "fullName": "pubcoreagencia/PUB-BEATS",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Plataforma de Venda de Beats e Instrumentais da PUB RECORDS.",
    "currentTask": "Manutenção autônoma e sincronização contínua de PUB-BEATS"
  },
  {
    "name": "pub-bnb",
    "fullName": "pubcoreagencia/pub-bnb",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Gestão algorítmica de locações de temporada e hospitalidade de luxo.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-bnb"
  },
  {
    "name": "pub-co",
    "fullName": "pubcoreagencia/pub-co",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Portal institucional global e portal de acesso central da PUB Holding.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-co"
  },
  {
    "name": "PUB-CORE",
    "fullName": "pubcoreagencia/PUB-CORE",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de PUB-CORE"
  },
  {
    "name": "pub-core-holding-portal",
    "fullName": "pubcoreagencia/pub-core-holding-portal",
    "stage": "ONLINE",
    "priority": "P1",
    "cadence": "DAILY_MORNING",
    "ownerAgent": "architect",
    "description": "Portal institucional e comercial da Pub Core Holding, desenvolvido em Next.js.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-core-holding-portal"
  },
  {
    "name": "pub-core-os",
    "fullName": "pubcoreagencia/pub-core-os",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "architect",
    "description": "Sistema operacional institucional e unificador de governança da holding.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-core-os"
  },
  {
    "name": "pub-crypto",
    "fullName": "pubcoreagencia/pub-crypto",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "reviewer",
    "description": "Gestão de tesouraria em criptoativos e infraestrutura blockchain.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-crypto"
  },
  {
    "name": "pub-dev-loop",
    "fullName": "pubcoreagencia/pub-dev-loop",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-dev-loop"
  },
  {
    "name": "pub-dev-loop-prototypes",
    "fullName": "pubcoreagencia/pub-dev-loop-prototypes",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Persistent repository for PUB Prototype sessions",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-dev-loop-prototypes"
  },
  {
    "name": "pub-dev-loop-template",
    "fullName": "pubcoreagencia/pub-dev-loop-template",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Template repository for PUB DEV LOOP continuity",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-dev-loop-template"
  },
  {
    "name": "pub-ecom",
    "fullName": "pubcoreagencia/pub-ecom",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-ecom"
  },
  {
    "name": "pub-ecom-catalog-worker",
    "fullName": "pubcoreagencia/pub-ecom-catalog-worker",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-ecom-catalog-worker"
  },
  {
    "name": "pub-ecom-landing",
    "fullName": "pubcoreagencia/pub-ecom-landing",
    "stage": "ONLINE",
    "priority": "P1",
    "cadence": "DAILY_MORNING",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-ecom-landing"
  },
  {
    "name": "pub-films",
    "fullName": "pubcoreagencia/pub-films",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Produção audiovisual cinematográfica e publicidade de alto impacto.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-films"
  },
  {
    "name": "pub-films-landing",
    "fullName": "pubcoreagencia/pub-films-landing",
    "stage": "ONLINE",
    "priority": "P1",
    "cadence": "DAILY_MORNING",
    "ownerAgent": "video-editor",
    "description": "Landing page cinematografica da PUB FILMS.",
    "currentTask": "Atualizar showreel audiovisual e otimizar streaming HLS"
  },
  {
    "name": "pub-food",
    "fullName": "pubcoreagencia/pub-food",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Operação de dark kitchens, delivery inteligente e controle de suprimentos.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-food"
  },
  {
    "name": "pub-games-studio",
    "fullName": "pubcoreagencia/pub-games-studio",
    "stage": "IDEA",
    "priority": "P2",
    "cadence": "BIWEEKLY_SCAFFOLD",
    "ownerAgent": "qa-engineer",
    "description": "Desenvolvimento de jogos independentes e gamificação corporativa.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-games-studio"
  },
  {
    "name": "pub-github-mcp",
    "fullName": "pubcoreagencia/pub-github-mcp",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY_AFTERNOON",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-github-mcp"
  },
  {
    "name": "pub-ia",
    "fullName": "pubcoreagencia/pub-ia",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Hub e orquestrador de inteligência artificial generativa e preditiva.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-ia"
  },
  {
    "name": "pub-imoveis",
    "fullName": "pubcoreagencia/pub-imoveis",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Plataforma inteligente de transações imobiliárias e tokenização de ativos.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-imoveis"
  },
  {
    "name": "pub-lancamentos",
    "fullName": "pubcoreagencia/pub-lancamentos",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "architect",
    "description": "Infraestrutura e playbooks para lançamentos digitais em escala.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-lancamentos"
  },
  {
    "name": "pub-leads",
    "fullName": "pubcoreagencia/pub-leads",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "growth-ops",
    "description": null,
    "currentTask": "Orquestrar pipeline de captura B2B e enriquecimento de decisores"
  },
  {
    "name": "pub-machine",
    "fullName": "pubcoreagencia/pub-machine",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "growth-ops",
    "description": "Motor automatizado de prospecção e geração de negócios da PUB.",
    "currentTask": "Verificar entregabilidade de emails e cadências outbound"
  },
  {
    "name": "pub-machine-2",
    "fullName": "pubcoreagencia/pub-machine-2",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Evolução autônoma de segunda geração do motor Machine.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-machine-2"
  },
  {
    "name": "pub-machine-saas",
    "fullName": "pubcoreagencia/pub-machine-saas",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Versão multi-tenant SaaS da PUB Machine para clientes externos.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-machine-saas"
  },
  {
    "name": "pub-media",
    "fullName": "pubcoreagencia/pub-media",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Braço de distribuição de mídia de performance e tráfego pago.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-media"
  },
  {
    "name": "pub-neural",
    "fullName": "pubcoreagencia/pub-neural",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "developer",
    "description": "Cérebro cognitivo, memória episódica/semântica e orquestrador multiagente.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-neural"
  },
  {
    "name": "pub-ops-hub",
    "fullName": "pubcoreagencia/pub-ops-hub",
    "stage": "IDEA",
    "priority": "P2",
    "cadence": "BIWEEKLY_SCAFFOLD",
    "ownerAgent": "qa-engineer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-ops-hub"
  },
  {
    "name": "pub-prototype",
    "fullName": "pubcoreagencia/pub-prototype",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Ambiente de prototipação rápida de interfaces e produtos.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-prototype"
  },
  {
    "name": "pub-records",
    "fullName": "pubcoreagencia/pub-records",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "sound-engineer",
    "description": "Gravadora, estúdio de produção musical, PUB Beats e PUB DAW.",
    "currentTask": "Masterizar catálogo de beats e unificar streaming WebAudio"
  },
  {
    "name": "pub-scrapping",
    "fullName": "pubcoreagencia/pub-scrapping",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY_AFTERNOON",
    "ownerAgent": "developer",
    "description": "Engenharia de scrapers e ingestores de dados (Shopee, Mercado Livre, etc).",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-scrapping"
  },
  {
    "name": "pub-shopee-scraper",
    "fullName": "pubcoreagencia/pub-shopee-scraper",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY_AFTERNOON",
    "ownerAgent": "growth-ops",
    "description": null,
    "currentTask": "Auditar seletores anti-bloqueio e monitoramento de mercado"
  },
  {
    "name": "pub-start",
    "fullName": "pubcoreagencia/pub-start",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Incubadora e framework de bootstrap de novos negócios digitais.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-start"
  },
  {
    "name": "pub-textil",
    "fullName": "pubcoreagencia/pub-textil",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Confecção inteligente, private label e cadeia de suprimentos têxteis.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-textil"
  },
  {
    "name": "pub-trade",
    "fullName": "pubcoreagencia/pub-trade",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Sistemas algorítmicos automatizados de trading quantitativo.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pub-trade"
  },
  {
    "name": "pub3d-landing",
    "fullName": "pubcoreagencia/pub3d-landing",
    "stage": "ONLINE",
    "priority": "P1",
    "cadence": "DAILY_MORNING",
    "ownerAgent": "image-designer",
    "description": null,
    "currentTask": "Renderizar shaders PBR interativos e showroom 3D"
  },
  {
    "name": "pubcore",
    "fullName": "pubcoreagencia/pubcore",
    "stage": "ONLINE",
    "priority": "P0",
    "cadence": "CONTINUOUS_4H",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pubcore"
  },
  {
    "name": "pubcoreagencia.github.io",
    "fullName": "pubcoreagencia/pubcoreagencia.github.io",
    "stage": "ONLINE",
    "priority": "P1",
    "cadence": "DAILY_MORNING",
    "ownerAgent": "developer",
    "description": "Portal institucional Pub Core Holding",
    "currentTask": "Manutenção autônoma e sincronização contínua de pubcoreagencia.github.io"
  },
  {
    "name": "pubecomhub",
    "fullName": "pubcoreagencia/pubecomhub",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pubecomhub"
  },
  {
    "name": "pubet",
    "fullName": "pubcoreagencia/pubet",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": "Plataforma de entretenimento e apostas reguladas.",
    "currentTask": "Manutenção autônoma e sincronização contínua de pubet"
  },
  {
    "name": "pubfood-control-growth",
    "fullName": "pubcoreagencia/pubfood-control-growth",
    "stage": "IDEA",
    "priority": "P2",
    "cadence": "BIWEEKLY_SCAFFOLD",
    "ownerAgent": "qa-engineer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pubfood-control-growth"
  },
  {
    "name": "pubgrowth-ai-evolution",
    "fullName": "pubcoreagencia/pubgrowth-ai-evolution",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pubgrowth-ai-evolution"
  },
  {
    "name": "pubgrowthai",
    "fullName": "pubcoreagencia/pubgrowthai",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "developer",
    "description": null,
    "currentTask": "Manutenção autônoma e sincronização contínua de pubgrowthai"
  },
  {
    "name": "xp-audio-lab",
    "fullName": "pubcoreagencia/xp-audio-lab",
    "stage": "DEV",
    "priority": "P1",
    "cadence": "DAILY",
    "ownerAgent": "sound-engineer",
    "description": "Laboratório de design de som experimental e plugins VST/WebAudio.",
    "currentTask": "Criar presets de sintetizadores analógicos e vinhetas sonoras"
  }
];

export function getCurrentShift(): ShiftInfo {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return OFFICE_SHIFTS[0];
  if (hour >= 6 && hour < 12) return OFFICE_SHIFTS[1];
  if (hour >= 12 && hour < 18) return OFFICE_SHIFTS[2];
  return OFFICE_SHIFTS[3];
}

export function getProjectsByAgent(agentId: string): ScheduledProject[] {
  return SCHEDULED_PROJECTS.filter((p) => p.ownerAgent === agentId);
}
