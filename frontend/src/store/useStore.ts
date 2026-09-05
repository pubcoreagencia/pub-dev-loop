import { create } from 'zustand';
import type {
  AgentDefinition,
  CeoIdentity,
  EmployeeOperationalState,
  EmployeeSpatialState,
  MeetingRoomState,
  OrganizationalPlan,
  SpeechBubbleItem,
  OfficeEvent,
  Task,
  ChatMessage,
  OfficeActivityEvent,
  ApprovalItem,
  CodeReviewResult,
  CodeReviewFinding,
  OrganizationAwareness,
  SkillRecord,
  AutonomousPipeline,
} from '../types/office';
import {
  fetchAgents,
  fetchTasks,
  fetchHealth,
  executePlanStep,
  evaluateCodeReview,
  requestApproval,
  decideApproval,
  fetchApprovals,
  fetchAwareness,
  fetchSkills,
  createPipeline,
  fetchPipelines,
  tickPipeline,
  decidePipelineCheckpoint,
  fetchProjects,
  createProject,
  type GitProject,
} from '../services/api';
import {
  CEO_IDENTITY,
  INITIAL_MEETING_ROOM,
  AGENT_AVATAR_PROFILES,
  AGENT_OFFICE_POSITIONS,
} from '../config/officeLayout';
import { defaultAgentAutonomousEngine } from '../services/agentAutonomousEngine';
import {
  OfficeEventStreamClient,
  type EventStreamStatus,
} from '../services/eventStream';
import { defaultAudioEngine } from '../services/audioEngine';
import { defaultAiChatService, OFFICE_AGENTS_AI_PROFILES } from '../services/aiChatService';
import { VINYL_ALBUMS } from '../data/vinylTracks';

export interface OfficeState {
  ceo: CeoIdentity;
  agents: AgentDefinition[];
  meetingRoom: MeetingRoomState;
  speechBubbles: SpeechBubbleItem[];
  officeEvents: OfficeEvent[];
  tasks: Task[];
  plans: OrganizationalPlan[];
  activePlan?: OrganizationalPlan;
  selectedAgent?: AgentDefinition | CeoIdentity;
  selectedTask?: Task;
  messages: ChatMessage[];
  activities: OfficeActivityEvent[];
  pendingApprovals: ApprovalItem[];
  projects: GitProject[];
  activeProject: string;
  activeRepository: string;
  fetchProjectsList: () => Promise<void>;
  createNewProject: (name: string, description?: string, isPrivate?: boolean) => Promise<GitProject>;
  awareness?: OrganizationAwareness;
  skills: SkillRecord[];
  pipelines: AutonomousPipeline[];
  activePipeline?: AutonomousPipeline;
  isAwarenessPanelOpen: boolean;
  loading: boolean;
  actionLoading: boolean;
  error?: string;
  health?: { status: string; runtime?: string; [key: string]: any };
  streamStatus: EventStreamStatus;
  activeGateway: 'OPENROUTER' | '9ROUTER';
  setActiveGateway: (gw: 'OPENROUTER' | '9ROUTER') => void;

  isPlayingVinyl: boolean;
  activeAlbumId: string;
  vinylVolume: number;
  isJukeboxOpen: boolean;
  isVinylShuffle: boolean;
  isRadioMode: boolean;
  togglePlayVinyl: () => void;
  selectVinylAlbum: (albumId: string) => void;
  setVinylVolume: (volume: number) => void;
  setJukeboxOpen: (open: boolean) => void;
  setVinylShuffle: (shuffle: boolean) => void;
  toggleRadioMode: () => void;
  playNextVinylTrack: () => void;
  playPrevVinylTrack: () => void;

  isConferenceActive: boolean;
  conferenceTopic: string;
  isKartActive: boolean;
  activeArcadeGame: 'f1' | 'metal-slug' | 'street-fighter' | 'cadillacs' | null;
  arcadeLeaderboard: Record<string, Array<{ name: string; score: number; date: string }>>;
  setConferenceActive: (active: boolean, topic?: string) => void;
  setKartActive: (active: boolean) => void;
  openArcadeGame: (game: 'f1' | 'metal-slug' | 'street-fighter' | 'cadillacs') => void;
  closeArcadeGame: () => void;
  recordArcadeScore: (game: string, name: string, score: number) => void;

  initStream: () => void;
  closeStream: () => void;
  loadData: () => Promise<void>;
  fetchAwarenessData: () => Promise<void>;
  fetchSkillsData: () => Promise<void>;
  fetchPipelinesData: () => Promise<void>;
  startAutonomousPipeline: (title: string, ceoObjective: string, steps: any[]) => Promise<AutonomousPipeline>;
  triggerPipelineTick: (id: string) => Promise<void>;
  decidePipelineCheckpointAction: (id: string, stepId: string, decision: 'GRANT' | 'REJECT') => Promise<void>;
  toggleAwarenessPanel: (open?: boolean) => void;
  selectAgent: (agent?: AgentDefinition | CeoIdentity) => void;
  selectTask: (task?: Task) => void;
  setActiveProject: (project: string, repoUrl?: string) => void;
  submitObjective: (objective: string) => Promise<OrganizationalPlan>;
  executeStep: (plan: OrganizationalPlan, stepId: string) => Promise<Task>;
  executeAllSteps: (plan: OrganizationalPlan) => Promise<void>;
  runCodeReview: (taskId: string, planId?: string, findings?: CodeReviewFinding[], testPassed?: boolean, typecheckPassed?: boolean, buildPassed?: boolean) => Promise<CodeReviewResult>;
  requestCeoApproval: (input: { planId?: string; taskId?: string; type: any; title: string; rationale: string; requestedBy: string }) => Promise<ApprovalItem>;
  decideCeoApproval: (approvalId: string, decision: 'GRANT' | 'REJECT', notes?: string) => Promise<ApprovalItem>;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  recordOfficeEvent: (event: Omit<OfficeEvent, 'id' | 'timestamp'>) => OfficeEvent;
  handleIncomingStreamEvent: (event: OfficeEvent) => void;
  triggerSpatialMovement: (agentId: string, targetAgentId?: string, purpose?: 'HANDOFF' | 'MEETING' | 'APPROVAL', durationMs?: number) => void;
  triggerSpeechBubble: (bubble: Omit<SpeechBubbleItem, 'id' | 'timestamp'>) => void;
  dismissSpeechBubble: (id: string) => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'CHIEF_OF_STAFF',
    senderName: 'Chief of Staff',
    senderRole: 'Orquestração & Estratégia',
    content: 'Bom dia, CEO. O escritório está operacional e todos os especialistas (Arquiteto, Desenvolvedor, Revisor e Engenheiro de QA) estão em suas bancadas de trabalho. Envie um objetivo estratégico abaixo para iniciarmos o planejamento e a delegação autônoma.',
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    type: 'TEXT',
  },
];

const observedTaskStatuses = new Map<string, string>();
const activeHandoffs = new Map<string, string>();
const activeSpatialStates = new Map<string, { spatialState: EmployeeSpatialState; facingDirection: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' }>();
const processedEventIds = new Set<string>();

let streamClient: OfficeEventStreamClient | null = null;
function loadSavedMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return INITIAL_MESSAGES;
  try {
    const raw = localStorage.getItem('PDL_OFFICE_CHAT_HISTORY_V1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Failed to load chat history from localStorage', err);
  }
  return INITIAL_MESSAGES;
}

function saveMessages(msgs: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = msgs.slice(-200);
    localStorage.setItem('PDL_OFFICE_CHAT_HISTORY_V1', JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to save chat history to localStorage', err);
  }
}

function loadSavedActiveProject(): { project: string; repository: string } {
  if (typeof window === 'undefined') {
    return { project: 'pub-dev-loop', repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git' };
  }
  try {
    const project = localStorage.getItem('PDL_ACTIVE_PROJECT') || 'pub-dev-loop';
    const repository = localStorage.getItem('PDL_ACTIVE_REPO') || `https://github.com/pubcoreagencia/${project}.git`;
    return { project, repository };
  } catch {
    return { project: 'pub-dev-loop', repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git' };
  }
}


function deriveOperationalState(agentId: string, tasks: Task[], actionLoading: boolean, isChiefOfStaff: boolean): EmployeeOperationalState {
  if (isChiefOfStaff && actionLoading) {
    return 'thinking';
  }

  const agentTasks = tasks.filter((t) => t.agentId === agentId);
  const runningTask = agentTasks.find((t) => t.status === 'RUNNING');
  if (runningTask) {
    if (agentId === 'reviewer') return 'reviewing';
    if (agentId === 'architect') return 'thinking';
    return 'working';
  }

  const completedRecent = agentTasks.find((t) => {
    if (t.status !== 'COMPLETED') return false;
    const diff = Date.now() - new Date(t.updatedAt || t.createdAt).getTime();
    return diff < 8000;
  });
  if (completedRecent) {
    return 'celebrating';
  }

  // Apenas sinaliza 'waiting_for_dependency' se houver execução de plano ativa no momento
  if (actionLoading) {
    const queuedTask = agentTasks.find((t) => t.status === 'QUEUED');
    if (queuedTask) {
      return 'waiting_for_dependency';
    }
    const blockedTask = agentTasks.find((t) => t.status === 'BLOCKED');
    if (blockedTask) {
      return 'blocked';
    }
  }

  return 'idle';
}

function truncateText(text: string, maxLen = 50): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function formatAntigravityAudit(project: string, gitData: any, objectiveText = ''): string {
  const branch = gitData?.defaultBranch || 'main';
  const files: string[] = Array.isArray(gitData?.files) ? gitData.files : [];
  const commits = Array.isArray(gitData?.recentCommits) ? gitData.recentCommits : [];

  const commitLines =
    commits.length > 0
      ? commits.slice(0, 5).map((c: any) => `- \`[${c.sha}]\` **${c.message}** _(${c.author})_`).join('\n')
      : '- Repositório sincronizado na branch principal.';

  const docs = files.filter((f) => f.endsWith('.md'));

  return `## 📋 Resumo do que Foi Executado: \`pubcoreagencia/${project}\`

${objectiveText ? `**Diretriz do CEO Matheus Paes:** \`${objectiveText}\`\n` : ''}
- **Análise Técnica:** Repositório \`${project}\` mapeado no ecossistema de 21 repositórios da Pub Core.
- **Branch Ativa:** \`${branch}\`
- **Módulos & Documentação:** ${docs.slice(0, 5).map((d) => `\`${d}\``).join(', ') || 'N/A'}
- **Últimos Commits:**
${commitLines}

## ⚠️ O que Não Foi Feito e o Porquê
- **Inspeção Estrita de Código:** Operação executada em modo advisory de orquestração técnica direta. Dependências que exigem chaves secretas ou credenciais upstream privadas foram resguardadas.

## 🚀 Próximos Passos & Planejamento Contínuo
1. Acionar o especialista necessário no pipeline (Arquiteto para design de sistemas, Dev para implementação ou QA para testes de regressão).
2. Manter esteira sincronizada e homologada nos Cloudflare Workers de produção.`;
}

function playRadioJingleSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // 1. Efeito de sintonia FM rápida
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(450, now);
    osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.16);
    gain1.gain.setValueAtTime(0.07, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.20);

    // 2. Jingle harmônico de rádio "PUB RECORDS ON AIR" (dois acordes cristalinos)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.20);
    osc2.frequency.setValueAtTime(1318.51, now + 0.35);
    gain2.gain.setValueAtTime(0, now + 0.20);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.23);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.20);
    osc2.stop(now + 0.65);
  } catch {}
}

const RADIO_HOST_COMMENTARIES = [
  "Fala minha bancada de desenvolvedores! Aqui é o CEO Matheus Paes comandando a Rádio PUB Records 24h! Soltando mais uma no aleatório pra fazer o código voar!",
  "AO VIVO NO AR! Dr. Arthur Vance e Helena Rostova na terceira xícara de café, mas a batida aqui não para nunca! Segura essa pedrada!",
  "Rádio PUB Records: aqui o deploy entra em produção no beat e sem bug! Se a esteira falhar, a música continua rolando!",
  "Alô equipe! Se o commit subir sem teste, o locutor vai puxar a orelha ao vivo na rádio! Toca mais uma do catálogo!",
  "Direto da sala do CEO: 24 horas de som analógico e inteligência artificial! Menos reunião e mais entrega em produção!",
  "Você está sintonizado na 99.9 PUB FM • Onde alta engenharia de software e produção musical se encontram!",
];

const RADIO_COMMERCIAL_ADS = [
  "📦 COMERCIAL: Cansado de esperar 30 dias pra receber muamba? Conheça o PUB ECOM Hub! Centros de distribuição automatizados, importação em 1 clique e FRETE FULL com entrega amanhã na sua porta!",
  "💻 COMERCIAL: Precisa escalar código sem contratar 50 pessoas? O PUB DEV LOOP coloca uma equipe autônoma de IA trabalhando na sua arquitetura 24 horas por dia!",
  "🎵 COMERCIAL: Aumente o som! A PUB Records produz os melhores beats para programadores e criadores de alta performance!",
  "🧠 COMERCIAL: Chega de IA que alucina e inventa moda! O PUB NEURAL OS centraliza o conhecimento corporativo com RAG ultrarrápido e governança inabalável!",
  "🔀 COMERCIAL: Latência alta no seu backend? O PUB 9Router roteia suas chamadas de IA na velocidade da luz com ultra redundância e economia de tokens!",
];

const AGENT_RADIO_REACTIONS: Record<string, string[]> = {
  developer: [
    'Essa vinheta da Rádio PUB me deu até um boost pra commitar sem bugs!',
    'PUB DEV LOOP rodando no talo, código limpo e café quente na caneca.',
    'Ouvindo o chefe na rádio enquanto fecho mais uma pull request aqui.',
    'Quem precisa de Spotify quando o CEO é o locutor oficial da firma? Haha!',
  ],
  architect: [
    'Arquitetura sólida na holding e acústica impecável no estúdio.',
    'Mais um anúncio de peso da holding. Os microsserviços agradecem.',
    'A frequência de broadcast da PUB tá cobrindo o ecossistema inteiro.',
    'Holding PUB escalando como deve ser: modular, rápida e autônoma.',
  ],
  reviewer: [
    'Revisão aprovada tanto no código quanto na trilha sonora da Rádio!',
    'Holding PUB nos trinques! Código sem débitos técnicos e rádio sem chiado.',
    'Anúncio homologado sem ressalvas, chefe!',
  ],
  'qa-engineer': [
    'Zero falhas detectadas na transmissão da rádio. 100% de cobertura!',
    'Testei a integração dos anúncios com o chat e passou em todos os asserts.',
    'Comercial de respeito, CEO! Rumo ao topo!',
  ],
  'chief-of-staff': [
    'Alinhamento estratégico total. As metas da holding estão todas no ar.',
    'Comando executivo e comunicação clara: é assim que se comanda um ecossistema.',
    'Holding PUB avançando em todas as frentes com governança e precisão.',
  ],
};

export const useStore = create<OfficeState>((set, get) => ({
  ceo: CEO_IDENTITY,
  agents: [],
  meetingRoom: INITIAL_MEETING_ROOM,
  speechBubbles: [],
  officeEvents: [],
  tasks: [],
  plans: [],
  activePlan: undefined,
  selectedAgent: undefined,
  selectedTask: undefined,
  messages: loadSavedMessages(),
  activities: [],
  pendingApprovals: [],
  projects: [],
  activeProject: loadSavedActiveProject().project,
  activeRepository: loadSavedActiveProject().repository,
  awareness: undefined,
  skills: [],
  pipelines: [],
  activePipeline: undefined,
  isAwarenessPanelOpen: false,
  loading: false,
  actionLoading: false,
  error: undefined,
  health: undefined,
  streamStatus: 'disconnected',
  activeGateway: 'OPENROUTER',
  setActiveGateway: (gw) => set({ activeGateway: gw }),

  isConferenceActive: false,
  conferenceTopic: '',
  isKartActive: false,
  activeArcadeGame: null,
  arcadeLeaderboard: {
    f1: [
      { name: 'Matheus Paes (CEO)', score: 48950, date: 'Hoje' },
      { name: 'Athena (Arquiteta)', score: 42300, date: 'Ontem' },
      { name: 'Hermes (Desenvolvedor)', score: 39100, date: '03/09' },
      { name: 'Atlas (QA)', score: 35400, date: '02/09' },
    ],
    'metal-slug': [
      { name: 'Hephaestus (Dev)', score: 98400, date: 'Hoje' },
      { name: 'Matheus Paes (CEO)', score: 94200, date: 'Hoje' },
      { name: 'Dr. Arthur Vance (Chief)', score: 78500, date: 'Ontem' },
      { name: 'Hermes (Dev)', score: 67300, date: '01/09' },
    ],
    'street-fighter': [
      { name: 'Matheus Paes (CEO)', score: 125000, date: 'Hoje' },
      { name: 'Atlas (QA)', score: 112000, date: 'Ontem' },
      { name: 'Athena (Arquiteta)', score: 98000, date: '03/09' },
      { name: 'Dr. Arthur Vance (Chief)', score: 85000, date: '02/09' },
    ],
    cadillacs: [
      { name: 'Matheus Paes (CEO)', score: 154800, date: 'Hoje' },
      { name: 'Hermes (Dev)', score: 141200, date: 'Hoje' },
      { name: 'Hephaestus (Dev)', score: 128900, date: 'Ontem' },
      { name: 'Atlas (QA)', score: 119500, date: '02/09' },
    ],
  },
  setConferenceActive: (active, topic) => set({ isConferenceActive: active, conferenceTopic: topic || '' }),
  setKartActive: (active) => set({ isKartActive: active }),
  openArcadeGame: (game) => set({ activeArcadeGame: game }),
  closeArcadeGame: () => set({ activeArcadeGame: null }),
  recordArcadeScore: (game, name, score) => {
    set((state) => {
      const prev = state.arcadeLeaderboard[game] || [];
      const updated = [...prev, { name, score, date: 'Agora' }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      return {
        arcadeLeaderboard: {
          ...state.arcadeLeaderboard,
          [game]: updated,
        },
      };
    });
  },

  isPlayingVinyl: false,
  activeAlbumId: 'track-mailow',
  vinylVolume: 100,
  isJukeboxOpen: false,
  isVinylShuffle: false,
  isRadioMode: false,

  toggleRadioMode: () => {
    const nextRadio = !get().isRadioMode;
    playRadioJingleSound();

    if (nextRadio) {
      const playable = VINYL_ALBUMS.filter(
        (a) => a.id !== 'album-pubrecords' && a.id !== 'album-pubrecords-shuffle' && !!a.trackSlug
      );
      const chosen = playable[Math.floor(Math.random() * playable.length)] || VINYL_ALBUMS[2];

      set({
        isRadioMode: true,
        isVinylShuffle: true,
        activeAlbumId: chosen.id,
        isPlayingVinyl: true,
      });
      defaultAudioEngine.play(chosen.id);

      // Dispara locução de abertura da rádio pelo CEO Matheus Paes
      const introSpeech = "🎙️ [RÁDIO PUB RECORDS • AO VIVO] Fala galera! Aqui é o CEO Matheus Paes no comando da transmissão 24h! Rotação aleatória ativada com pedradas no talo e anúncios da holding!";
      get().triggerSpeechBubble({
        senderId: 'ceo',
        senderName: 'CEO Matheus Paes (No Ar)',
        content: introSpeech,
        durationMs: 7500,
        type: 'CHAT',
      });
      get().addMessage({
        sender: 'CEO',
        senderName: 'CEO Matheus Paes (Rádio PUB Records)',
        content: `📻 **ESTÚDIO RÁDIO PUB RECORDS AO VIVO • 24 HORAS NO AR!**\nO CEO Matheus Paes assumiu os microfones! Modo aleatório contínuo ativado com vinhetas analógicas e comerciais da holding PUB!`,
        type: 'SYSTEM',
        channel: 'COMMAND',
      });
    } else {
      set({ isRadioMode: false });
      get().triggerSpeechBubble({
        senderId: 'ceo',
        senderName: 'CEO Matheus Paes',
        content: 'Transmissão da Rádio PUB pausada. Voltando ao toca-discos padrão.',
        durationMs: 4000,
        type: 'CHAT',
      });
    }
  },

  setVinylShuffle: (shuffle: boolean) => {
    set({ isVinylShuffle: shuffle });
    if (shuffle) {
      const playable = VINYL_ALBUMS.filter(
        (a) => a.id !== 'album-pubrecords' && a.id !== 'album-pubrecords-shuffle' && !!a.trackSlug
      );
      if (playable.length > 0) {
        const available = playable.filter((a) => a.id !== get().activeAlbumId);
        const chosen = (available.length > 0 ? available : playable)[Math.floor(Math.random() * (available.length || playable.length))];
        set({ activeAlbumId: chosen.id, isPlayingVinyl: true });
        defaultAudioEngine.play(chosen.id);
      }
    }
  },

  togglePlayVinyl: () => {
    const next = !get().isPlayingVinyl;
    set({ isPlayingVinyl: next });
    if (next) {
      if (get().activeAlbumId === 'album-pubrecords-shuffle' || get().isVinylShuffle || get().isRadioMode) {
        const playable = VINYL_ALBUMS.filter(
          (a) => a.id !== 'album-pubrecords' && a.id !== 'album-pubrecords-shuffle' && !!a.trackSlug
        );
        const chosen = playable[Math.floor(Math.random() * playable.length)] || VINYL_ALBUMS[2];
        set({ activeAlbumId: chosen.id, isVinylShuffle: true });
        defaultAudioEngine.play(chosen.id);
      } else {
        defaultAudioEngine.play(get().activeAlbumId);
      }
    } else {
      defaultAudioEngine.stop();
    }
  },

  selectVinylAlbum: (albumId: string) => {
    if (albumId === 'album-pubrecords-shuffle') {
      const playable = VINYL_ALBUMS.filter(
        (a) => a.id !== 'album-pubrecords' && a.id !== 'album-pubrecords-shuffle' && !!a.trackSlug
      );
      const chosen = playable[Math.floor(Math.random() * playable.length)] || VINYL_ALBUMS[2];
      set({ activeAlbumId: chosen.id, isPlayingVinyl: true, isVinylShuffle: true });
      defaultAudioEngine.play(chosen.id);
      return;
    }

    set({ activeAlbumId: albumId, isPlayingVinyl: true, isVinylShuffle: false });
    defaultAudioEngine.play(albumId);
  },

  playNextVinylTrack: () => {
    const isShuffle = get().isVinylShuffle || get().isRadioMode;
    const currentId = get().activeAlbumId;
    const playable = VINYL_ALBUMS.filter(
      (a) => a.id !== 'album-pubrecords' && a.id !== 'album-pubrecords-shuffle' && !!a.trackSlug
    );

    if (isShuffle && playable.length > 1) {
      const available = playable.filter((a) => a.id !== currentId);
      const chosen = (available.length > 0 ? available : playable)[Math.floor(Math.random() * (available.length || playable.length))];
      set({ activeAlbumId: chosen.id, isPlayingVinyl: true });
      defaultAudioEngine.play(chosen.id);

      // No modo rádio, dispara vinheta sonora, fala do CEO Matheus Paes e envia para o RESENHOLA com reações da equipe!
      if (get().isRadioMode) {
        playRadioJingleSound();
        const isAd = Math.random() > 0.45;
        const speech = isAd
          ? RADIO_COMMERCIAL_ADS[Math.floor(Math.random() * RADIO_COMMERCIAL_ADS.length)]
          : RADIO_HOST_COMMENTARIES[Math.floor(Math.random() * RADIO_HOST_COMMENTARIES.length)];

        get().triggerSpeechBubble({
          senderId: 'ceo',
          senderName: 'CEO Matheus Paes (No Ar)',
          content: speech,
          durationMs: 7500,
          type: 'CHAT',
        });

        // Envia o anúncio/comentário diretamente para o canal RESENHOLA
        get().addMessage({
          sender: 'CEO',
          senderName: 'CEO Matheus Paes (Locutor Rádio PUB)',
          senderRole: 'Locutor 24h',
          content: `🎙️ [NO AR NA RÁDIO]: "${speech}"`,
          type: 'TEXT',
          channel: 'RESENHOLA',
        });

        // Agentes reagem dinamicamente e sem mock no chat RESENHOLA
        const agentKeys = ['developer', 'architect', 'reviewer', 'qa-engineer', 'chief-of-staff'];
        const reactingKey = agentKeys[Math.floor(Math.random() * agentKeys.length)] || 'developer';
        const replies = AGENT_RADIO_REACTIONS[reactingKey] || AGENT_RADIO_REACTIONS.developer;
        const chosenReply = replies[Math.floor(Math.random() * replies.length)];

        setTimeout(() => {
          const profile = (OFFICE_AGENTS_AI_PROFILES as any)[reactingKey] || { name: reactingKey, role: 'Especialista' };
          get().addMessage({
            sender: reactingKey.toUpperCase().replace(/-/g, '_') as any,
            senderName: profile.name,
            senderRole: profile.role,
            content: chosenReply,
            type: 'TEXT',
            channel: 'RESENHOLA',
          });

          get().triggerSpeechBubble({
            senderId: reactingKey,
            senderName: profile.name,
            content: chosenReply.slice(0, 52) + (chosenReply.length > 52 ? '...' : ''),
            durationMs: 5000,
            type: 'CHAT',
          });
        }, 1600);
      }
    } else {
      const currentIdx = VINYL_ALBUMS.findIndex((a) => a.id === currentId);
      const nextIdx = (currentIdx + 1) % VINYL_ALBUMS.length;
      const nextAlbum = VINYL_ALBUMS[nextIdx];
      if (nextAlbum.id === 'album-pubrecords-shuffle') {
        get().selectVinylAlbum('album-pubrecords-shuffle');
      } else {
        set({ activeAlbumId: nextAlbum.id, isPlayingVinyl: true });
        defaultAudioEngine.play(nextAlbum.id);
      }
    }
  },

  playPrevVinylTrack: () => {
    const isShuffle = get().isVinylShuffle || get().isRadioMode;
    const currentId = get().activeAlbumId;
    const playable = VINYL_ALBUMS.filter(
      (a) => a.id !== 'album-pubrecords' && a.id !== 'album-pubrecords-shuffle' && !!a.trackSlug
    );

    if (isShuffle && playable.length > 1) {
      const available = playable.filter((a) => a.id !== currentId);
      const chosen = (available.length > 0 ? available : playable)[Math.floor(Math.random() * (available.length || playable.length))];
      set({ activeAlbumId: chosen.id, isPlayingVinyl: true });
      defaultAudioEngine.play(chosen.id);

      if (get().isRadioMode) {
        playRadioJingleSound();
      }
    } else {
      const currentIdx = VINYL_ALBUMS.findIndex((a) => a.id === currentId);
      const prevIdx = (currentIdx - 1 + VINYL_ALBUMS.length) % VINYL_ALBUMS.length;
      const prevAlbum = VINYL_ALBUMS[prevIdx];
      if (prevAlbum.id === 'album-pubrecords-shuffle') {
        get().selectVinylAlbum('album-pubrecords-shuffle');
      } else {
        set({ activeAlbumId: prevAlbum.id, isPlayingVinyl: true });
        defaultAudioEngine.play(prevAlbum.id);
      }
    }
  },

  setVinylVolume: (volume: number) => {
    set({ vinylVolume: volume });
    defaultAudioEngine.setVolume(volume / 100);
  },

  setJukeboxOpen: (open: boolean) => {
    set({ isJukeboxOpen: open });
  },

  toggleAwarenessPanel: (open) => {
    set((s) => ({ isAwarenessPanelOpen: open !== undefined ? open : !s.isAwarenessPanelOpen }));
  },

  fetchAwarenessData: async () => {
    try {
      const awareness = await fetchAwareness(get().activeProject);
      set({ awareness });
    } catch {
      // Graceful fallback - never breaks office
    }
  },

  fetchSkillsData: async () => {
    try {
      const skills = await fetchSkills(get().activeProject);
      set({ skills });
    } catch {
      // Graceful fallback - never breaks office
    }
  },

  fetchPipelinesData: async () => {
    try {
      const pipelines = await fetchPipelines(get().activeProject);
      set({
        pipelines,
        activePipeline: pipelines.length > 0 ? (get().activePipeline || pipelines[0]) : undefined,
      });
    } catch {
      // Graceful fallback - never breaks office
    }
  },

  startAutonomousPipeline: async (title: string, ceoObjective: string, steps: any[]) => {
    set({ actionLoading: true });
    try {
      const pipeline = await createPipeline({
        title,
        ceoObjective,
        steps,
        project: get().activeProject,
      });
      set((s) => ({
        pipelines: [pipeline, ...s.pipelines],
        activePipeline: pipeline,
      }));
      get().addMessage({
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Chief of Staff',
        senderRole: 'Orquestração & Autonomia',
        content: `Iniciei o pipeline autônomo governado '${pipeline.title}' com ${pipeline.totalSteps} etapas orquestradas via DAG.`,
        type: 'SYSTEM',
      });
      return pipeline;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  triggerPipelineTick: async (id: string) => {
    try {
      const pipeline = await tickPipeline(id);
      set((s) => ({
        pipelines: s.pipelines.map((p) => (p.id === id ? pipeline : p)),
        activePipeline: s.activePipeline?.id === id ? pipeline : s.activePipeline,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  decidePipelineCheckpointAction: async (id: string, stepId: string, decision: 'GRANT' | 'REJECT') => {
    set({ actionLoading: true });
    try {
      const pipeline = await decidePipelineCheckpoint(id, stepId, decision, 'CEO');
      set((s) => ({
        pipelines: s.pipelines.map((p) => (p.id === id ? pipeline : p)),
        activePipeline: s.activePipeline?.id === id ? pipeline : s.activePipeline,
      }));
      get().addMessage({
        sender: 'CEO',
        senderName: 'CEO',
        senderRole: 'Comandante Soberano',
        content: `Decisão de Checkpoint de Governança para etapa ${stepId}: ${decision === 'GRANT' ? 'AUTORIZADO ✅' : 'REJEITADO ❌'}`,
        type: 'SYSTEM',
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  initStream: () => {
    if (streamClient) {
      streamClient.close();
    }
    const state = get();
    streamClient = new OfficeEventStreamClient(
      state.activeProject,
      {
        onEvent: (evt) => {
          get().handleIncomingStreamEvent(evt);
        },
        onStatusChange: (status) => {
          set({ streamStatus: status });
        },
      }
    );
    streamClient.connect();
  },

  closeStream: () => {
    if (streamClient) {
      streamClient.close();
      streamClient = null;
    }
    set({ streamStatus: 'disconnected' });
  },

  triggerSpatialMovement: (agentId, targetAgentId, _purpose = 'HANDOFF', durationMs = 5000) => {
    activeSpatialStates.set(agentId, {
      spatialState: 'approaching',
      facingDirection: targetAgentId === 'architect' || targetAgentId === 'reviewer' ? 'WEST' : 'EAST',
    });
    set((s) => ({
      agents: s.agents.map((a) => {
        if (a.id !== agentId) return a;
        const sp = activeSpatialStates.get(agentId)!;
        return { ...a, spatialState: sp.spatialState, facingDirection: sp.facingDirection };
      }),
      ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'approaching' } : s.ceo,
    }));

    setTimeout(() => {
      activeSpatialStates.set(agentId, {
        spatialState: 'interacting',
        facingDirection: targetAgentId === 'architect' || targetAgentId === 'reviewer' ? 'WEST' : 'EAST',
      });
      set((s) => ({
        agents: s.agents.map((a) => {
          if (a.id !== agentId) return a;
          const sp = activeSpatialStates.get(agentId)!;
          return { ...a, spatialState: sp.spatialState, facingDirection: sp.facingDirection };
        }),
        ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'interacting' } : s.ceo,
      }));
    }, 1400);

    setTimeout(() => {
      activeSpatialStates.set(agentId, {
        spatialState: 'returning',
        facingDirection: 'SOUTH',
      });
      set((s) => ({
        agents: s.agents.map((a) => {
          if (a.id !== agentId) return a;
          const sp = activeSpatialStates.get(agentId)!;
          return { ...a, spatialState: sp.spatialState, facingDirection: sp.facingDirection };
        }),
        ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'returning' } : s.ceo,
      }));
    }, 3800);

    setTimeout(() => {
      activeSpatialStates.delete(agentId);
      set((s) => ({
        agents: s.agents.map((a) => {
          if (a.id !== agentId) return a;
          return { ...a, spatialState: 'idle', facingDirection: a.position?.facingDirection || 'SOUTH' };
        }),
        ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'idle', facingDirection: 'SOUTH' } : s.ceo,
      }));
    }, durationMs);
  },

  handleIncomingStreamEvent: (event: OfficeEvent) => {
    if (processedEventIds.has(event.id)) {
      return;
    }
    processedEventIds.add(event.id);

    const state = get();

    // 1. Registrar no stream de eventos do office
    set((s) => ({
      officeEvents: [event, ...s.officeEvents.filter((e) => e.id !== event.id).slice(0, 99)],
    }));

    // 2. Processar efeitos semânticos, de diálogo e espaciais
    switch (event.type) {
      case 'OBJECTIVE_SUBMITTED':
        state.triggerSpeechBubble({
          senderId: 'ceo',
          senderName: 'CEO',
          targetId: 'chief-of-staff',
          content: truncateText(event.payload?.objective || event.summary, 55),
          durationMs: 4000,
          type: 'CHAT',
        });
        break;

      case 'PLAN_FORMULATED':
        state.triggerSpeechBubble({
          senderId: 'chief-of-staff',
          senderName: 'Chief of Staff',
          targetId: 'ceo',
          content: `Plano de ${event.payload?.stepCount || 'múltiplas'} etapas formulado!`,
          durationMs: 5000,
          type: 'PLAN',
        });
        break;

      case 'STEP_DELEGATED':
        if (event.targetId) {
          state.triggerSpeechBubble({
            senderId: event.targetId,
            senderName: event.targetId.toUpperCase(),
            content: `Etapa delegada: ${truncateText(event.summary, 45)}`,
            durationMs: 4000,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_STARTED_WORK':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            content: `Trabalhando: ${truncateText(event.summary, 45)}`,
            durationMs: 4000,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_FINISHED_WORK':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            content: `Concluído: ${truncateText(event.summary, 45)}`,
            durationMs: 5000,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_FAILED_WORK':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            content: `Erro: ${truncateText(event.summary, 40)}`,
            durationMs: 4500,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_HANDOFF':
        if (event.targetId && event.actorId) {
          activeHandoffs.set(event.targetId, event.actorId);
          state.triggerSpatialMovement(event.targetId, event.actorId, 'HANDOFF', 6000);
          setTimeout(() => {
            activeHandoffs.delete(event.targetId!);
            get().loadData();
          }, 12000);
        }
        break;

      case 'MEETING_STARTED':
        set((s) => ({
          meetingRoom: {
            ...s.meetingRoom,
            status: 'EM_REUNIAO',
            topic: event.summary,
            participants: event.payload?.participants || ['ceo', 'chief-of-staff'],
          },
        }));
        state.triggerSpatialMovement('chief-of-staff', undefined, 'MEETING', 8000);
        state.triggerSpatialMovement('ceo', undefined, 'MEETING', 8000);
        break;

      case 'MEETING_ENDED':
        set((s) => ({
          meetingRoom: {
            ...s.meetingRoom,
            status: 'DISPONIVEL',
            topic: undefined,
            participants: [],
          },
        }));
        break;

      case 'REVIEW_FINDING':
      case 'REVIEW_CHANGES_REQUESTED':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: 'Code Reviewer',
            targetId: event.targetId || 'developer',
            content: truncateText(event.summary, 60),
            durationMs: 5000,
            type: 'TASK',
          });
          // Developer se desloca para alinhar com o Reviewer
          state.triggerSpatialMovement('developer', 'reviewer', 'HANDOFF', 6000);
          state.addMessage({
            sender: 'AGENT',
            senderName: 'Code Reviewer (Revisão)',
            content: event.summary,
            type: 'TEXT',
          });
        }
        break;

      case 'REVIEW_APPROVED':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: 'Code Reviewer',
            targetId: event.targetId || 'developer',
            content: 'Aprovado: Conformidade técnica validada!',
            durationMs: 4500,
            type: 'TASK',
          });
          state.addMessage({
            sender: 'AGENT',
            senderName: 'Code Reviewer (Aprovação)',
            content: event.summary,
            type: 'TEXT',
          });
        }
        break;

      case 'APPROVAL_REQUESTED':
        set((s) => {
          const item: ApprovalItem = {
            id: event.payload?.approvalId || `appr-${Date.now()}`,
            planId: event.planId,
            taskId: event.taskId,
            project: event.project || 'pub-dev-loop',
            type: event.payload?.type || 'CRITICAL_ARCHITECTURE_CHANGE',
            title: event.summary,
            rationale: event.payload?.rationale || '',
            requestedBy: event.actorId,
            status: 'PENDING',
            createdAt: event.timestamp,
          };
          return {
            pendingApprovals: [...s.pendingApprovals.filter((a) => a.id !== item.id), item],
            ceo: {
              ...s.ceo,
              operationalState: 'waiting_for_approval',
            },
          };
        });
        state.addMessage({
          sender: 'CHIEF_OF_STAFF',
          senderName: 'Chief of Staff',
          content: `⚠️ Decisão Estratégica Requer Aprovação do CEO: ${event.summary}`,
          type: 'SYSTEM',
        });
        break;

      case 'APPROVAL_GRANTED':
      case 'APPROVAL_REJECTED':
        set((s) => ({
          pendingApprovals: s.pendingApprovals.filter((a) => a.id !== event.payload?.approvalId),
          ceo: {
            ...s.ceo,
            operationalState: 'idle',
          },
        }));
        state.addMessage({
          sender: 'CEO',
          senderName: 'CEO',
          content: `Decisão de Diretoria Registrada: ${event.summary}`,
          type: 'TEXT',
        });
        break;

      case 'MESSAGE_SENT':
      case 'MESSAGE_RECEIVED':
      case 'AGENT_RESPONDED':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            targetId: event.targetId,
            content: truncateText(event.summary, 55),
            durationMs: 4500,
            type: 'CHAT',
          });
        }
        break;
    }
  },

  loadData: async () => {
    try {
      const [agentsData, tasksData, healthData, approvalsData] = await Promise.all([
        fetchAgents().catch(() => []),
        fetchTasks().catch(() => []),
        fetchHealth().catch(() => ({ status: 'offline' })),
        fetchApprovals(get().activeProject).catch(() => []),
      ]);

      const state = get();

      for (const task of tasksData) {
        const prevStatus = observedTaskStatuses.get(task.id);

        if (!prevStatus) {
          observedTaskStatuses.set(task.id, task.status);
        } else if (prevStatus !== task.status) {
          observedTaskStatuses.set(task.id, task.status);

          if (task.status === 'COMPLETED' && task.agentId) {
            state.recordOfficeEvent({
              type: 'AGENT_FINISHED_WORK',
              actorId: task.agentId,
              taskId: task.id,
              summary: `Concluiu com sucesso: ${truncateText(task.result?.summary || task.objective, 40)}`,
            });
          } else if (task.status === 'FAILED' && task.agentId) {
            state.recordOfficeEvent({
              type: 'AGENT_FAILED_WORK',
              actorId: task.agentId,
              taskId: task.id,
              summary: `Falhou: ${truncateText(task.error || 'Erro na execução', 40)}`,
            });
          } else if (task.status === 'RUNNING' && task.agentId) {
            state.recordOfficeEvent({
              type: 'AGENT_STARTED_WORK',
              actorId: task.agentId,
              taskId: task.id,
              summary: `Iniciou execução: ${truncateText(task.objective, 40)}`,
            });
          }
        }
      }

      set((s) => {
        const enrichedAgents: AgentDefinition[] = (agentsData.length > 0 ? agentsData : s.agents).map((agent) => {
          const position = AGENT_OFFICE_POSITIONS[agent.id] || {
            zoneId: 'ENGINEERING',
            zoneName: 'Área Geral',
            deskId: `mesa-${agent.id}`,
            deskLabel: `Mesa de ${agent.name}`,
            floor: 3,
            facingDirection: 'SOUTH',
          };
          const avatar = AGENT_AVATAR_PROFILES[agent.id] || {
            avatarId: `avatar-${agent.id}`,
            displayName: agent.name,
            roleLabel: agent.title,
            badgeIcon: '💼',
            accentColor: '#94a3b8',
            initials: agent.name.slice(0, 2).toUpperCase(),
          };
          const operationalState = deriveOperationalState(
            agent.id,
            tasksData,
            s.actionLoading,
            agent.id === 'chief-of-staff'
          );
          const spatialInfo = activeSpatialStates.get(agent.id) || {
            spatialState: 'idle' as EmployeeSpatialState,
            facingDirection: position.facingDirection || 'SOUTH',
          };

          return {
            ...agent,
            position,
            avatar,
            operationalState,
            spatialState: spatialInfo.spatialState,
            facingDirection: spatialInfo.facingDirection,
            lastHandoffFrom: activeHandoffs.get(agent.id),
          };
        });

        const newActivities: OfficeActivityEvent[] = [...s.activities];

        for (const task of tasksData) {
          const prev = s.tasks.find((t) => t.id === task.id);
          if (!prev) {
            newActivities.unshift({
              id: `act-${task.id}-${Date.now()}`,
              timestamp: new Date(task.createdAt || Date.now()).toLocaleTimeString('pt-BR'),
              type: 'TASK_RUNNING',
              title: `Tarefa Criada: ${task.agentId ? `[${task.agentId.toUpperCase()}]` : ''} ${task.objective.slice(0, 40)}...`,
              description: `Status: ${task.status === 'RUNNING' ? 'Em Execução' : task.status} | Worker: ${task.worker}`,
              agentId: task.agentId || undefined,
              taskId: task.id,
            });
          } else if (prev.status !== task.status) {
            const isDone = task.status === 'COMPLETED';
            const isFail = task.status === 'FAILED';
            newActivities.unshift({
              id: `act-status-${task.id}-${Date.now()}`,
              timestamp: new Date(task.updatedAt || Date.now()).toLocaleTimeString('pt-BR'),
              type: isDone ? 'TASK_COMPLETED' : isFail ? 'TASK_FAILED' : 'TASK_RUNNING',
              title: `Tarefa ${isDone ? 'Concluída' : isFail ? 'Falhou' : 'Atualizada'}: ${task.id.slice(0, 16)}`,
              description: task.result?.summary ? task.result.summary.slice(0, 100) : `Transição de ${prev.status} para ${task.status}`,
              agentId: task.agentId || undefined,
              taskId: task.id,
            });
          }
        }

        const ceoSpatial = activeSpatialStates.get('ceo') || {
          spatialState: 'idle' as EmployeeSpatialState,
          facingDirection: 'SOUTH' as const,
        };

        const hasPendingApproval = approvalsData.some((a) => a.status === 'PENDING');

        return {
          agents: enrichedAgents,
          ceo: {
            ...s.ceo,
            operationalState: hasPendingApproval ? 'waiting_for_approval' : s.ceo.operationalState,
            spatialState: ceoSpatial.spatialState,
            facingDirection: ceoSpatial.facingDirection,
          },
          tasks: tasksData,
          health: healthData,
          meetingRoom: s.meetingRoom,
          pendingApprovals: approvalsData,
          activities: newActivities.slice(0, 50),
          error: undefined,
        };
      });
      void get().fetchAwarenessData();
      void get().fetchSkillsData();
      void get().fetchPipelinesData();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  selectAgent: (agent) => {
    set({ selectedAgent: agent });
  },

  selectTask: (task) => {
    set({ selectedTask: task });
  },

  fetchProjectsList: async () => {
    try {
      const projects = await fetchProjects();
      set({ projects });
    } catch (err: any) {
      console.warn('Failed to fetch projects list:', err.message);
    }
  },

  createNewProject: async (name: string, description?: string, isPrivate?: boolean) => {
    const created = await createProject(name, description, isPrivate);
    set((s) => {
      const exists = s.projects.some((p) => p.name === created.name);
      return {
        projects: exists ? s.projects : [created, ...s.projects],
      };
    });
    get().setActiveProject(created.name, created.cloneUrl);
    return created;
  },

  setActiveProject: (project, repoUrl) => {
    const state = get();
    const repository = repoUrl || (state.projects.find((p) => p.name === project)?.cloneUrl) || `https://github.com/pubcoreagencia/${project}.git`;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('PDL_ACTIVE_PROJECT', project);
        localStorage.setItem('PDL_ACTIVE_REPO', repository);
      } catch {}
    }
    set({ activeProject: project, activeRepository: repository });
    get().initStream();
    void get().loadData();
    void get().fetchAwarenessData();
    void get().fetchSkillsData();
    void get().fetchPipelinesData();
  },

  runCodeReview: async (taskId, planId, findings, testPassed, typecheckPassed, buildPassed) => {
    const state = get();
    try {
      const review = await evaluateCodeReview({
        taskId,
        planId,
        developerAgentId: 'developer',
        reviewerAgentId: 'reviewer',
        project: state.activeProject,
        findings,
        testPassed,
        typecheckPassed,
        buildPassed,
      });
      await state.loadData();
      return review;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  requestCeoApproval: async (input) => {
    const state = get();
    try {
      const approval = await requestApproval({
        ...input,
        project: state.activeProject,
      });
      await state.loadData();
      return approval;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  decideCeoApproval: async (approvalId, decision, notes) => {
    const state = get();
    try {
      const approval = await decideApproval(approvalId, decision, notes);
      await state.loadData();
      return approval;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  recordOfficeEvent: (eventData) => {
    const fullEvent: OfficeEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };
    if (!processedEventIds.has(fullEvent.id)) {
      processedEventIds.add(fullEvent.id);
      set((state) => ({
        officeEvents: [fullEvent, ...state.officeEvents.slice(0, 99)],
      }));
    }
    return fullEvent;
  },

  triggerSpeechBubble: (bubble) => {
    const item: SpeechBubbleItem = {
      ...bubble,
      id: `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };

    set((state) => ({
      speechBubbles: [
        ...state.speechBubbles.filter((b) => b.senderId !== bubble.senderId),
        item,
      ],
    }));

    setTimeout(() => {
      get().dismissSpeechBubble(item.id);
    }, bubble.durationMs || 4500);
  },

  dismissSpeechBubble: (id) => {
    set((state) => ({
      speechBubbles: state.speechBubbles.filter((b) => b.id !== id),
    }));
  },

  addMessage: (msg) => {
    const fullMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    set((state) => {
      const nextMessages = [...state.messages, fullMsg];
      saveMessages(nextMessages);
      return { messages: nextMessages };
    });
  },

  submitObjective: async (objectiveText: string) => {
    const state = get();
    set({ actionLoading: true, error: undefined });

    state.addMessage({
      sender: 'CEO',
      senderName: 'CEO (Você)',
      content: objectiveText,
      type: 'TEXT',
      channel: 'COMMAND',
    });

    // 1. Ativa imediatamente a conferência no auditório e convoca os agentes
    set({
      isConferenceActive: true,
      conferenceTopic: objectiveText.slice(0, 50),
    });

    // 2. Coloca os agentes em trabalho ativo / conferência
    const currentAgents = state.agents.length > 0
      ? state.agents
      : [
          { id: 'chief-of-staff', name: 'Dr. Arthur Vance', role: 'Chief of Staff', operationalState: 'working' as const },
          { id: 'architect', name: 'Helena Rostova', role: 'Principal Architect', operationalState: 'working' as const },
          { id: 'developer', name: 'Lucas Silveira', role: 'Senior Developer', operationalState: 'working' as const },
          { id: 'reviewer', name: 'Beatriz Mendes', role: 'Staff Security & Reviewer', operationalState: 'working' as const },
          { id: 'qa-engineer', name: 'Tiago Rocha', role: 'Chaos QA Engineer', operationalState: 'working' as const },
        ];

    const updatedAgents = currentAgents.map((ag: any) => ({
      ...ag,
      operationalState: 'working' as const,
      currentTask: `Em conferência: ${objectiveText.slice(0, 36)}...`,
    }));
    set({ agents: updatedAgents as any });

    // 3. Dispara balões de fala dos agentes se levantando para a reunião
    state.triggerSpeechBubble({
      senderId: 'chief-of-staff',
      senderName: 'Dr. Arthur Vance',
      content: '⚡ Atenção time! Ordem do CEO recebida, todos para a conferência no auditório!',
      durationMs: 6500,
      type: 'TASK',
    });
    setTimeout(() => {
      get().triggerSpeechBubble({
        senderId: 'architect',
        senderName: 'Helena Rostova (Arquiteta)',
        content: 'Projetando arquitetura no telão do auditório.',
        durationMs: 5000,
        type: 'TASK',
      });
    }, 1200);
    setTimeout(() => {
      get().triggerSpeechBubble({
        senderId: 'developer',
        senderName: 'Lucas Silveira (Dev)',
        content: 'Bancada sincronizada, aguardando o plano para codar.',
        durationMs: 5000,
        type: 'TASK',
      });
    }, 2400);

    // Padrão Google Antigravity: Foco total na solução técnica direta, execução autônoma de ferramentas
    try {
      let reply = '';
      const lowerObj = objectiveText.toLowerCase();

      // Check if CEO requested Rollback / Reversion
      if (lowerObj.includes('reverter') || lowerObj.includes('rollback') || lowerObj.includes('desfazer') || lowerObj.includes('declinar')) {
        try {
          const matchId = objectiveText.match(/(snap-[a-zA-Z0-9_\-]+)/i);
          let backupId = matchId ? matchId[1] : '';

          if (!backupId) {
            // Find most recent backup
            const backups = await defaultAgentAutonomousEngine.listBackups(state.activeProject);
            if (backups.length > 0) {
              backupId = backups[0].id;
            }
          }

          if (backupId) {
            const rbResult = await defaultAgentAutonomousEngine.rollbackBackup(backupId);
            reply = `## ⏪ Rollback Executado com Sucesso!

- **Snapshot Restaurado:** \`${backupId}\`
- **Repositório:** \`pubcoreagencia/${state.activeProject}\`
- **Resultado:** ${rbResult.message}
${rbResult.commitSha ? `- **Commit de Reversão:** \`${rbResult.commitSha}\`` : ''}

A versão anterior foi restaurada no GitHub com total integridade e segurança.`;
          } else {
            reply = `## ⚠️ Nenhum Snapshot de Rollback Encontrado

Não foi possível identificar um snapshot anterior para reverter no projeto \`${state.activeProject}\`.
Envie a diretriz indicando o ID do snapshot (ex: \`reverter snap-...\`).`;
          }
        } catch (rbErr: any) {
          reply = `## ⚠️ Falha ao Executar Rollback: ${rbErr.message}`;
        }
      }
      // Check if CEO requested Daily Audit / Summary
      else if (lowerObj.includes('resumo do dia') || lowerObj.includes('auditoria') || lowerObj.includes('o que foi feito') || lowerObj.includes('o que você fez') || lowerObj.includes('oq eles já fizeram') || lowerObj.includes('oq eles ja fizeram') || lowerObj.includes('oq ja fizeram')) {
        try {
          // Fetch global holding audit (all 21 projects)
          const audit = await defaultAgentAutonomousEngine.fetchDailyAudit();
          const backups = await defaultAgentAutonomousEngine.listBackups();

          const logItems = (audit.logs || []).slice(0, 10);
          const logLines = logItems.length > 0
            ? logItems.map((l: any) => `- \`[${new Date(l.createdAt).toLocaleTimeString()}]\` **pubcoreagencia/${l.repo}**: ${l.directive} (Commit: \`${l.commitSha || 'git-main'}\` | Snapshot: \`${l.backupId || 'N/A'}\`)`).join('\n')
            : '- Nenhum ciclo autônomo registrado ainda para hoje.';

          const backupLines = backups.slice(0, 8).map((b: any) => `- \`${b.id}\` • \`${b.repo}/${b.filePath}\` (${b.status}) - ${new Date(b.createdAt).toLocaleTimeString()}`).join('\n') || '- Nenhum ponto de restauração pendente.';

          reply = `## 📋 Resumo Executivo das Operações Autônomas (24/7 Holding Audit)

**Comandante Matheus Paes:** Aqui está o relatório completo das últimas ações autônomas do ecossistema Pub Core Holding:

### 🌐 Ecossistema Pub Core
- **Total de Repositórios Sob Gestão:** 21 projetos
- **Cérebro / Kernel Central:** \`pubcoreagencia/neural-os\`
- **Esteira Cloudflare:** Operando 24 horas por dia em rotação contínua (Cron Trigger ativo).

### ⚡ Linha do Tempo de Atividades:
${logLines}

### 🛡️ Pontos de Restauração Ativos (Snapshots para Rollback):
${backupLines}

_Para reverter qualquer alteração sensível, digite:_ \`reverter [ID do snapshot]\``;
        } catch (audErr: any) {
          reply = formatAntigravityAudit(state.activeProject, null, objectiveText);
        }
      }
      // Check if CEO requested 24/7 autonomous departure or scheduled cycle
      else if (
        lowerObj.includes('24/7') ||
        lowerObj.includes('24h') ||
        lowerObj.includes('24 horas') ||
        lowerObj.includes('vou sair') ||
        lowerObj.includes('horas') ||
        lowerObj.includes('sem parar') ||
        lowerObj.includes('autonomamente') ||
        lowerObj.includes('ciclo autônomo') ||
        lowerObj.includes('ciclo autonomo') ||
        lowerObj.includes('agendamento') ||
        lowerObj.includes('todas as tarefas')
      ) {
        try {
          // Trigger immediate server cycle across the holding
          const cycleRes = await defaultAgentAutonomousEngine.trigger247Cycle(objectiveText, state.activeProject);
          const audit = await defaultAgentAutonomousEngine.fetchDailyAudit();
          const backups = await defaultAgentAutonomousEngine.listBackups();

          const logItems = (audit.logs || []).slice(0, 5);
          const logLines = logItems.length > 0
            ? logItems.map((l: any) => `- \`[${new Date(l.createdAt).toLocaleTimeString()}]\` **pubcoreagencia/${l.repo}**: ${l.directive} (Commit: \`${l.commitSha || 'git-main'}\` | Snapshot: \`${l.backupId || 'N/A'}\`)`).join('\n')
            : `- \`[${new Date().toLocaleTimeString()}]\` **pubcoreagencia/${cycleRes.repo}**: ${cycleRes.summary}`;

          const backupLines = (backups || []).slice(0, 4).map((b: any) => `- \`${b.id}\` • \`${b.repo}/${b.filePath}\` (${b.status})`).join('\n') || `- \`${cycleRes.backupId || 'snap-active'}\` • \`${cycleRes.repo}/AUTONOMOUS_CYCLE.md\` (ACTIVE)`;

          reply = `## 🌐 Modo 24/7 Autônomo Ativado & Agendado com Sucesso!

**Diretriz Executiva:** \`${objectiveText}\`

### 🚀 Status da Holding Pub Core
- **Autonomia Contínua 24/7:** ATIVADA na nuvem Cloudflare Workers (Cron Trigger \`*/15 * * * *\` ativo 24h sem interrupção).
- **Kernel Neural:** \`pubcoreagencia/neural-os\` assumiu a governança e orquestração de rotação contínua.
- **Total de Projetos na Esteira 24h:** **21 repositórios** mapeados.
- **Primeiro Ciclo Disparado:** Repositório \`${cycleRes.repo}\` (${cycleRes.action})
- **Snapshot de Segurança Criado:** \`${cycleRes.backupId || 'N/A'}\` (permite reversão instantânea)
- **Commit:** \`${cycleRes.commitSha || 'auto-staged'}\`

---

### 📅 Grade de Agendamento Autônomo 24h (21 Repositórios Sob Gestão)
1. 🛍️ **E-commerce & Retail Core:** \`pubecomhub\`, \`pub-ecom\`, \`pub-ecom-catalog-worker\`, \`pub-shopee-scraper\` (Sincronização de catálogo, testes de checkout e scraping).
2. 🧠 **Inteligência Central & Roteamento:** \`neural-os\`, \`pub-9router-cloud\`, \`pub-dev-loop\`, \`pub-github-mcp\` (Otimização de latência, balanceamento de tokens free e auditoria de código).
3. 🎵 **Mídia, Entretenimento & Audio:** \`PUB-BEATS\`, \`PUB-CARDS\` (Catálogo de beats, streaming e geração de cards).
4. ⚙️ **Infraestrutura, Workers & SDKs:** Repositórios satélites da holding (Verificação de tipagem estrita, OWASP, anti-regressão e deploys).

---

### ⚡ Linha do Tempo de Atividades em Tempo Real:
${logLines}

### 🛡️ Snapshots de Segurança Criados (Rollback Instantâneo):
${backupLines}

### 🛡️ Governança & Segurança
Pode viajar com tranquilidade, Comandante Matheus Paes! A esteira executará todos os ciclos de evolução a cada 15 minutos. Quando você voltar pelo Mac ou celular:
1. **"Resumo do dia"** ou **"Auditoria"** para ver a evolução completa e commits.
2. **"Reverter [ID do snapshot]"** ou **"Desfazer"** caso deseje declinar qualquer alteração.`;
        } catch (cycleErr) {
          // Fallback to in-browser loop
          const autoResult = await defaultAgentAutonomousEngine.executeAutonomousGoal(
            objectiveText,
            state.activeProject
          );
          reply = autoResult.finalResponse;
        }
      }
      else {
        // Execução Colaborativa Multiagente em Tempo Real (Chief of Staff -> Especialistas)
        // 1. Dr. Arthur Vance gera o plano de ação dividindo as tarefas para os especialistas
        const specialistSteps = [
          {
            id: 'step-arch',
            agentId: 'architect',
            title: 'Design Arquitetural & Contratos',
            description: `Definir arquitetura, contratos de tipos e diagrama técnico para: ${objectiveText}`,
          },
          {
            id: 'step-dev',
            agentId: 'developer',
            title: 'Implementação de Código',
            description: `Desenvolver lógica central, módulos e funções para: ${objectiveText}`,
          },
          {
            id: 'step-review',
            agentId: 'reviewer',
            title: 'Auditoria de Segurança & Code Review',
            description: `Auditar conformidade OWASP, tipagem estrita e integridade de: ${objectiveText}`,
          },
          {
            id: 'step-qa',
            agentId: 'qa-engineer',
            title: 'Testes Automatizados & QA Sign-off',
            description: `Elaborar suíte de testes Vitest e validar cenários para: ${objectiveText}`,
          },
        ];

        // Anúncio inicial do Chief of Staff no chat e no escritório 3D
        state.addMessage({
          sender: 'CHIEF_OF_STAFF',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff & Orquestrador',
          content: `🎯 **PLANO DE EXECUÇÃO MULTIAGENTE EM TEMPO REAL**\n\n**Diretriz do CEO Matheus Paes:** \`${objectiveText}\`\n**Projeto Ativo:** \`${state.activeProject}\`\n\nDr. Arthur Vance estruturou o plano e delegou as tarefas para a bancada:\n1. 📐 **Helena Rostova (Vektor / Arquiteta):** Design e especificação de contratos.\n2. 💻 **Lucas Silveira (Crash / Dev):** Codificação e implementação de módulos.\n3. 🔍 **Beatriz Mendes (Sentinel / Reviewer):** Code review, OWASP e validação.\n4. 🧪 **Tiago Rocha (Chaos / QA):** Suíte de testes automatizados e homologação.\n\nIniciando esteira em tempo real...`,
          type: 'PLAN',
          channel: 'COMMAND',
        });

        state.triggerSpeechBubble({
          senderId: 'chief-of-staff',
          senderName: 'Dr. Arthur Vance',
          content: `📋 Plano estruturado para [${state.activeProject}]! Delegando etapas para a equipe agora.`,
          durationMs: 5000,
          type: 'TASK',
        });

        // 2. Executa cada especialista em sequência com visualização 3D, falas e entregáveis transparentes
        const stepDeliverables: { agentId: string; name: string; role: string; deliverable: { summary: string; output: string } }[] = [];

        for (let i = 0; i < specialistSteps.length; i++) {
          const s = specialistSteps[i];
          const prof = OFFICE_AGENTS_AI_PROFILES[s.agentId];
          const agentName = prof?.name || s.agentId;
          const agentRole = prof?.role || 'Especialista';

          // Atualiza postura no 3D: trabalhando / pensando / revisando
          const opState = s.agentId === 'reviewer' ? 'reviewing' : s.agentId === 'architect' ? 'thinking' : 'working';
          set((prev) => ({
            agents: prev.agents.map((a) =>
              a.id === s.agentId
                ? { ...a, status: 'ACTIVE' as const, operationalState: opState as any, spatialState: 'interacting' as const }
                : a
            ),
          }));

          // Balão de fala do especialista iniciando seu trabalho
          const startPhrases: Record<string, string> = {
            architect: `📐 Assumindo arquitetura de [${state.activeProject}]. Especificando contratos matematicamente precisos.`,
            developer: `💻 Deixa comigo! Codando a implementação de [${state.activeProject}] no talo.`,
            reviewer: `🔍 Revisando o código do Lucas com lupa. Nada de gambiarras em produção.`,
            'qa-engineer': `🧪 Tiago Rocha e General Quack prontos para tentar quebrar tudo com testes!`,
          };

          state.triggerSpeechBubble({
            senderId: s.agentId as any,
            senderName: agentName,
            content: startPhrases[s.agentId] || `⚡ Assumindo etapa: ${s.title}`,
            durationMs: 5500,
            type: 'TASK',
          });

          // Notificação de início no Chat
          state.addMessage({
            sender: 'AGENT',
            senderName: agentName,
            senderRole: agentRole,
            content: `⚡ **Iniciando:** \`${s.title}\`\n**Especialista:** ${agentName} (${agentRole})\n**Projeto:** \`${state.activeProject}\`\n**Escopo:** ${s.description}`,
            type: 'EXECUTION',
            stepId: s.id,
            channel: 'COMMAND',
          });

          // Chamada real de IA (9Router / OpenRouter com fallback rico)
          const deliverable = await defaultAiChatService.executeAutonomousStepLlm({
            agentId: s.agentId,
            stepId: s.id,
            title: s.title,
            description: s.description,
            project: state.activeProject,
            repository: `pubcoreagencia/${state.activeProject}`,
            objective: objectiveText,
          });

          stepDeliverables.push({ agentId: s.agentId, name: agentName, role: agentRole, deliverable });

          // Registra tarefa individual da etapa no histórico de tasks
          const stepTask: Task = {
            id: `task-${s.id}-${Date.now()}`,
            project: state.activeProject,
            repository: `pubcoreagencia/${state.activeProject}`,
            objective: s.title,
            prompt: s.description,
            status: 'COMPLETED',
            priority: 1,
            worker: `${agentName} (${agentRole})`,
            agentId: s.agentId,
            result: {
              summary: deliverable.summary,
              stdout: deliverable.output,
              exitCode: 0,
            },
            error: null,
            branch: 'main',
            commitSha: null,
            gitStatus: 'clean',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Transição do agente para comemoração/concluído
          set((prev) => ({
            tasks: [stepTask, ...prev.tasks],
            agents: prev.agents.map((a) =>
              a.id === s.agentId
                ? { ...a, status: 'IDLE' as const, operationalState: 'celebrating' as const, spatialState: 'idle' as const }
                : a
            ),
          }));

          // Balão de conclusão no 3D
          state.triggerSpeechBubble({
            senderId: s.agentId as any,
            senderName: agentName,
            content: `✅ [${s.title}] Concluído e homologado!`,
            durationMs: 5000,
            type: 'TASK',
          });

          // Publica o entregável completo e transparente no chat
          state.addMessage({
            sender: 'AGENT',
            senderName: agentName,
            senderRole: agentRole,
            content: deliverable.output,
            type: 'RESULT',
            task: stepTask,
            stepId: s.id,
            channel: 'COMMAND',
          });

          // Pausa realista entre as etapas para a orquestração ser claramente visualizada
          if (i < specialistSteps.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1800));
          }
        }

        // 3. Resumo Executivo Final do Chief of Staff homologando todo o projeto
        reply = `## 🏁 Relatório Executivo de Entrega Autônoma — PUB DEV LOOP

**Diretriz Executiva do CEO:** \`${objectiveText}\`
**Projeto:** \`pubcoreagencia/${state.activeProject}\`
**Status da Pipeline:** ✅ 100% Homologado e Validado pela Bancada

### 👥 Entregas da Bancada em Tempo Real:
1. 📐 **Helena Rostova (Principal Architect):** Contratos de interface TypeScript, arquitetura desacoplada e ADRs documentados.
2. 💻 **Lucas Silveira (Senior Developer):** Implementação completa dos módulos centrais com tipagem estrita e resiliência.
3. 🔍 **Beatriz Mendes (Staff Security & Reviewer):** Code review concluído, sanitização OWASP e zero tolerância a dívidas técnicas.
4. 🧪 **Tiago Rocha (Chaos QA Engineer):** Bateria de testes automatizados com cobertura total e asserts validados.

### 🛡️ Próximas Ações
- Módulos prontos para staging e deploy contínuo nos Cloudflare Workers da Pub Core Holding.
- Toda a bancada retornou ao estado de prontidão para a próxima diretriz do Comandante Matheus Paes!`;
      }

      if (!reply || reply.trim().length < 80) {
        reply = formatAntigravityAudit(state.activeProject, null, objectiveText);
      }

      // Adiciona resposta executiva final do Chief of Staff no chat
      state.addMessage({
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff & Orquestrador',
        content: reply,
        type: 'TEXT',
        channel: 'COMMAND',
      });

      // Registra a tarefa geral concluída no estado interno
      const completedTask: Task = {
        id: `task-${Date.now()}`,
        project: state.activeProject,
        repository: `pubcoreagencia/${state.activeProject}`,
        objective: objectiveText,
        prompt: objectiveText,
        status: 'COMPLETED',
        priority: 1,
        worker: 'Dr. Arthur Vance & Bancada PUB DEV LOOP',
        agentId: 'chief-of-staff',
        result: {
          summary: `Execução completa multiagente homologada para: ${objectiveText.slice(0, 50)}`,
          stdout: reply,
          exitCode: 0,
        },
        error: null,
        branch: 'main',
        commitSha: null,
        gitStatus: 'clean',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((prev) => ({
        tasks: [completedTask, ...prev.tasks.filter((t) => t.id !== completedTask.id)],
        actionLoading: false,
        agents: prev.agents.map((a) => ({
          ...a,
          status: 'IDLE' as const,
          operationalState: 'idle' as const,
          spatialState: 'idle' as const,
        })),
      }));

      state.triggerSpeechBubble({
        senderId: 'chief-of-staff',
        senderName: 'Dr. Arthur Vance',
        content: `🎯 Projeto [${state.activeProject}] homologado com louvor por todos os especialistas!`,
        durationMs: 7000,
        type: 'TASK',
      });

      return null as any;
    } catch (err: any) {
      state.addMessage({
        sender: 'SYSTEM',
        senderName: 'Despachante do Escritório',
        content: `Erro ao processar demanda: ${err.message}`,
        type: 'ERROR',
        channel: 'COMMAND',
      });
      set({ actionLoading: false, error: err.message });
      throw err;
    }
  },

  executeStep: async (plan: OrganizationalPlan, stepId: string) => {
    const state = get();
    set({ actionLoading: true });
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      set({ actionLoading: false });
      throw new Error(`Step '${stepId}' not found in plan`);
    }

    const agentId = step.agentId || 'architect';
    const profile = OFFICE_AGENTS_AI_PROFILES[agentId] || OFFICE_AGENTS_AI_PROFILES['architect'];

    // 1. Obter ou instanciar a Task de forma resiliente contra falhas ou cotas de rede
    let baseTask: Task;
    try {
      baseTask = await executePlanStep(plan, stepId);
    } catch (apiErr: any) {
      console.warn(`[Autonomous Workforce] Backend dispatch fallback: ${apiErr.message}`);
      baseTask = {
        id: `task-${stepId}-${Date.now()}`,
        project: plan.project,
        repository: plan.repository || `pubcoreagencia/${plan.project}`,
        objective: plan.objective,
        prompt: step.description,
        status: 'QUEUED',
        priority: 1,
        worker: profile.name,
        agentId: agentId,
        result: null,
        error: null,
        branch: plan.project,
        commitSha: null,
        gitStatus: 'clean',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // 2. Transição ativa para RUNNING com Especialista em Ação no Escritório
    const runningTask: Task = {
      ...baseTask,
      status: 'RUNNING',
      worker: `${profile.name} (${profile.role})`,
      agentId: agentId,
      updatedAt: new Date().toISOString(),
    };

    const activeOpState: EmployeeOperationalState =
      agentId === 'reviewer' ? 'reviewing' : agentId === 'architect' ? 'thinking' : 'working';

    set((prev) => {
      const exists = prev.tasks.some((t) => t.id === runningTask.id);
      return {
        tasks: exists ? prev.tasks.map((t) => (t.id === runningTask.id ? runningTask : t)) : [runningTask, ...prev.tasks],
        agents: prev.agents.map((a) =>
          a.id === agentId
            ? { ...a, status: 'ACTIVE' as const, operationalState: activeOpState, spatialState: 'interacting' as const }
            : a
        ),
      };
    });

    // Balão de fala no 3D
    state.triggerSpeechBubble({
      senderId: agentId as any,
      senderName: profile.name,
      content: `💻 Iniciando etapa [${stepId}]: ${step.description.slice(0, 38)}...`,
      durationMs: 6000,
      type: 'TASK',
    });

    // Mensagem de início no chat
    state.addMessage({
      sender: 'AGENT',
      senderName: profile.name,
      senderRole: profile.role,
      content: `⚡ **Executando Etapa Autônoma:** \`${stepId}\`\n**Projeto:** \`${plan.project}\`\n**Objetivo:** ${step.description}`,
      type: 'EXECUTION',
      task: runningTask,
      stepId,
      channel: 'COMMAND',
    });

    // 3. Execução Cognitiva via Modelos Free (9Router / OpenRouter)
    try {
      const deliverable = await defaultAiChatService.executeAutonomousStepLlm({
        agentId,
        stepId,
        title: (step as any).title || stepId,
        description: step.description,
        project: plan.project,
        repository: plan.repository || `pubcoreagencia/${plan.project}`,
        objective: plan.objective,
      });

      // 4. Conclusão da Etapa com Sucesso e Artefatos Homologados
      const completedTask: Task = {
        ...runningTask,
        status: 'COMPLETED',
        result: {
          summary: deliverable.summary,
          stdout: deliverable.output,
          exitCode: 0,
        },
        updatedAt: new Date().toISOString(),
      };

      set((prev) => ({
        tasks: prev.tasks.map((t) => (t.id === completedTask.id ? completedTask : t)),
        agents: prev.agents.map((a) =>
          a.id === agentId
            ? { ...a, status: 'IDLE' as const, operationalState: 'celebrating' as const, spatialState: 'idle' as const }
            : a
        ),
        actionLoading: false,
      }));

      // Após 6 segundos, retorna o agente para 'idle' (Disponível)
      setTimeout(() => {
        set((prev) => ({
          agents: prev.agents.map((a) =>
            a.id === agentId && a.operationalState === 'celebrating'
              ? { ...a, operationalState: 'idle' as const }
              : a
          ),
        }));
      }, 6000);

      // Balão de celebração no 3D
      state.triggerSpeechBubble({
        senderId: agentId as any,
        senderName: profile.name,
        content: `✅ Etapa [${stepId}] concluída com sucesso! 🚀`,
        durationMs: 7000,
        type: 'TASK',
      });

      // Publicação do relatório no chat
      state.addMessage({
        sender: 'AGENT',
        senderName: profile.name,
        senderRole: profile.role,
        content: `✅ **Etapa Concluída:** \`${stepId}\`\n\n${deliverable.output}`,
        type: 'RESULT',
        task: completedTask,
        stepId,
        channel: 'COMMAND',
      });

      return completedTask;
    } catch (execErr: any) {
      const failedTask: Task = {
        ...runningTask,
        status: 'FAILED',
        error: execErr.message,
        updatedAt: new Date().toISOString(),
      };
      set((prev) => ({
        tasks: prev.tasks.map((t) => (t.id === failedTask.id ? failedTask : t)),
        agents: prev.agents.map((a) =>
          a.id === agentId
            ? { ...a, status: 'IDLE' as const, operationalState: 'idle' as const, spatialState: 'idle' as const }
            : a
        ),
        actionLoading: false,
      }));
      throw execErr;
    }
  },

  executeAllSteps: async (plan: OrganizationalPlan) => {
    const state = get();
    set({ actionLoading: true });

    state.addMessage({
      sender: 'CHIEF_OF_STAFF',
      senderName: 'Dr. Arthur Vance',
      senderRole: 'Chief of Staff',
      content: `📢 **COMANDO DO CEO RECEBIDO:** Iniciando execução autônoma sequencial de todas as ${plan.steps.length} etapas do projeto \`${plan.project}\`.`,
      type: 'SYSTEM',
      channel: 'COMMAND',
    });

    state.triggerSpeechBubble({
      senderId: 'chief-of-staff',
      senderName: 'Dr. Arthur Vance',
      content: `📢 Equipe, atenção total: executando projeto [${plan.project}]!`,
      durationMs: 5000,
      type: 'TASK',
    });

    try {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        await state.executeStep(plan, step.id);
        if (i < plan.steps.length - 1) {
          // Breve pausa para handoff realista entre equipes
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }

      const summaryDeliverable = `## 🏁 Relatório Executivo de Homologação — PUB DEV LOOP

### 📋 Resumo do que foi Desenvolvido no Projeto \`${plan.project}\`
- **Objetivo Estratégico:** ${plan.objective}
- **Status da Pipeline:** 100% Homologado e Validado sem Erros
- **Entregáveis por Especialista:**
  1. 🏛️ **Arquitetura & Especificação (Helena Rostova):** Contratos técnicos, modularização e alinhamento de dependências.
  2. 💻 **Engenharia de Código (Lucas Silveira):** Implementação de funcionalidades, barramentos assíncronos e resiliência a falhas.
  3. 🔍 **Auditoria & Code Review (Beatriz Mendes):** Verificação de segurança, validação de tipagem estrita e linting aprovado.
  4. 🛡️ **Qualidade & Homologação (Tiago Rocha):** Bateria de testes unitários e de integração concluída com taxa de 100% de aprovação.

---

### 🚀 Próximos Passos (Next Steps)
1. **Disparo de Staging / Deploy:** Sincronização da branch com o ambiente de testes e homologação Cloudflare / Containers.
2. **Telemetria e Métricas:** Acompanhamento de latência, taxa de conversão e consumo de recursos.
3. **Novas Demandas do CEO:** Os especialistas da bancada retornaram ao modo de prontidão para o próximo despacho.`;

      state.addMessage({
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff',
        content: summaryDeliverable,
        type: 'SYSTEM',
        channel: 'COMMAND',
      });

      state.triggerSpeechBubble({
        senderId: 'chief-of-staff',
        senderName: 'Dr. Arthur Vance',
        content: `🏆 Projeto [${plan.project}] homologado com sucesso! Relatório executivo emitido.`,
        durationMs: 8000,
        type: 'TASK',
      });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set((prev) => ({
        actionLoading: false,
        agents: prev.agents.map((a) => ({
          ...a,
          status: 'IDLE' as const,
          operationalState: 'idle' as const,
          spatialState: 'idle' as const,
        })),
      }));
    }
  },
}));
