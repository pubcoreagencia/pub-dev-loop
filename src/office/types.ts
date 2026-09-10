export type AgentDepartment =
  | 'EXECUTIVE'
  | 'ENGINEERING'
  | 'QA'
  | 'MULTIMEDIA'
  | 'GROWTH'
  | 'Setor 1: B2B Growth, Inteligência de Leads & Scraping'
  | 'Setor 2: Plataforma Pub Machine & SaaS de Automação'
  | 'Setor 3: E-Commerce, Food Control & Varejo Digital'
  | 'Setor 4: Audiovisual, Cinema 4K & Indústria Musical'
  | 'Setor 5: Experiências Imersivas 3D & Estúdio de Jogos'
  | 'Setor 6: Manufatura Afetiva, Pets & 3D Físico'
  | 'Setor 7: Real Estate, Turismo Boutique & Hotelaria'
  | 'Setor 8: iGaming, Apostas Esportivas & PubBet'
  | 'Setor 9: Web3, Análise On-Chain & Cripto Inteligente'
  | 'Setor 10: Kernel Neural-OS & Infraestrutura Central';

export type AgentRole =
  | 'CHIEF_OF_STAFF'
  | 'ARCHITECT'
  | 'DEVELOPER'
  | 'REVIEWER'
  | 'QA_ENGINEER'
  | 'VIDEO_EDITOR'
  | 'IMAGE_DESIGNER'
  | 'SOUND_ENGINEER'
  | 'GROWTH_OPS'
  | 'TECH_LEAD'
  | 'FULLSTACK_DEV'
  | 'PRODUCT_DESIGNER'
  | 'QA_SECURITY'
  | 'GROWTH_SALES';

export type AgentRoutingProfile =
  | 'reasoning'
  | 'coding'
  | 'review'
  | 'fast_prototype'
  | 'multimedia'
  | 'growth'
  | 'general';

export type AgentStatus = 'ACTIVE' | 'IDLE' | 'PAUSED' | 'DEPRECATED';

export interface AgentDefinition {
  /** Unique agent identifier (e.g., 'chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer') */
  id: string;
  /** Human-friendly name of the agent */
  name: string;
  /** Formal job title */
  title: string;
  /** Organizational department */
  department: AgentDepartment;
  /** Functional organizational role */
  role: AgentRole;
  /** Technical or strategic area of expertise */
  specialty: string;
  /** High-level summary of personality and communication style */
  personalitySummary: string;
  /** Canonical list of core responsibilities */
  responsibilities: string[];
  /** Capabilities declared by this agent */
  capabilities: string[];
  /** Cognitive routing profile associated with the agent's work */
  routingProfile: AgentRoutingProfile;
  /** Reference to preferred model in MODEL_REGISTRY (optional) */
  preferredModel?: string;
  /** Base persona or system instruction template */
  systemPromptBase?: string;
  /** Whether the agent has managerial / task delegation authority */
  isManager?: boolean;
  /** Identifier of the supervising agent within the registry (null/undefined if reports to human CEO) */
  reportsTo?: string | null;
  /** Operational lifecycle status */
  status: AgentStatus;
}
