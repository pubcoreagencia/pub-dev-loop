import type {
  AvatarProfile,
  CeoIdentity,
  EmployeeOperationalState,
  MeetingRoomState,
  OfficePosition,
} from '../types/office';

export const CEO_IDENTITY: CeoIdentity = {
  id: 'ceo',
  name: 'CEO',
  title: 'Diretor Executivo / Operador Humano',
  role: 'CEO',
  status: 'ACTIVE',
  specialty: 'Direção Estratégica & Autoridade Final',
  personalitySummary: 'Líder estratégico focado em objetivos organizacionais e aprovação de decisões de alto impacto.',
  position: {
    zoneId: 'CEO_SUITE',
    zoneName: 'Gabinete Executivo do CEO',
    deskId: 'mesa-executiva-ceo',
    deskLabel: 'Mesa Principal do CEO',
    floor: 3,
  },
  avatar: {
    avatarId: 'avatar-ceo',
    displayName: 'CEO',
    roleLabel: 'Diretoria Executiva',
    badgeIcon: '👑',
    accentColor: '#8b5cf6',
    initials: 'CEO',
  },
};

export const INITIAL_MEETING_ROOM: MeetingRoomState = {
  id: 'sala-alinhamento-principal',
  name: 'Sala de Alinhamento & Estratégia',
  status: 'DISPONIVEL',
  participants: [],
};

export const AGENT_AVATAR_PROFILES: Record<string, AvatarProfile> = {
  'chief-of-staff': {
    avatarId: 'avatar-chief-of-staff',
    displayName: 'Chief of Staff',
    roleLabel: 'Orquestração & Coordenação',
    badgeIcon: '👔',
    accentColor: '#f59e0b',
    initials: 'CS',
  },
  architect: {
    avatarId: 'avatar-architect',
    displayName: 'Principal Architect',
    roleLabel: 'Arquitetura de Sistemas',
    badgeIcon: '📐',
    accentColor: '#3b82f6',
    initials: 'AR',
  },
  developer: {
    avatarId: 'avatar-developer',
    displayName: 'Senior Developer',
    roleLabel: 'Engenharia de Software',
    badgeIcon: '💻',
    accentColor: '#0ea5e9',
    initials: 'DV',
  },
  reviewer: {
    avatarId: 'avatar-reviewer',
    displayName: 'Code Reviewer',
    roleLabel: 'Revisão & Conformidade',
    badgeIcon: '🔍',
    accentColor: '#10b981',
    initials: 'RV',
  },
  'qa-engineer': {
    avatarId: 'avatar-qa-engineer',
    displayName: 'QA Engineer',
    roleLabel: 'Automação & Qualidade',
    badgeIcon: '🧪',
    accentColor: '#059669',
    initials: 'QA',
  },
};

export const AGENT_OFFICE_POSITIONS: Record<string, OfficePosition> = {
  'chief-of-staff': {
    zoneId: 'LEADERSHIP',
    zoneName: 'Suíte de Liderança & Orquestração',
    deskId: 'mesa-chief-of-staff',
    deskLabel: 'Estação da Chefia de Gabinete',
    floor: 3,
  },
  architect: {
    zoneId: 'ENGINEERING',
    zoneName: 'Laboratório de Engenharia de Software',
    deskId: 'mesa-architect',
    deskLabel: 'Bancada de Arquitetura',
    floor: 3,
  },
  developer: {
    zoneId: 'ENGINEERING',
    zoneName: 'Laboratório de Engenharia de Software',
    deskId: 'mesa-developer',
    deskLabel: 'Bancada de Desenvolvimento',
    floor: 3,
  },
  reviewer: {
    zoneId: 'QA',
    zoneName: 'Laboratório de Revisão & Qualidade',
    deskId: 'mesa-reviewer',
    deskLabel: 'Bancada de Code Review & Segurança',
    floor: 3,
  },
  'qa-engineer': {
    zoneId: 'QA',
    zoneName: 'Laboratório de Revisão & Qualidade',
    deskId: 'mesa-qa-engineer',
    deskLabel: 'Bancada de Testes & Automação',
    floor: 3,
  },
};

export const OPERATIONAL_STATE_LABELS_PT: Record<EmployeeOperationalState, { label: string; tagCls: string }> = {
  idle: { label: 'Disponível', tagCls: 'state-idle' },
  working: { label: 'Executando Tarefa', tagCls: 'state-working' },
  thinking: { label: 'Formulando Plano', tagCls: 'state-thinking' },
  reviewing: { label: 'Revisando Código', tagCls: 'state-reviewing' },
  collaborating: { label: 'Em Colaboração', tagCls: 'state-collaborating' },
  in_meeting: { label: 'Em Reunião de Alinhamento', tagCls: 'state-meeting' },
  waiting_for_dependency: { label: 'Aguardando Dependência', tagCls: 'state-waiting' },
  waiting_for_approval: { label: 'Aguardando Aprovação do CEO', tagCls: 'state-waiting' },
  celebrating: { label: 'Entrega Concluída', tagCls: 'state-celebrating' },
  learning: { label: 'Consolidando Aprendizado', tagCls: 'state-learning' },
  offline: { label: 'Desconectado', tagCls: 'state-offline' },
  blocked: { label: 'Bloqueado', tagCls: 'state-blocked' },
};
