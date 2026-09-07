import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { studioSynthAudio, type NoteEvent, type InstrumentCategory, type SynthPreset, type DrumComponent, type MasterPluginSettings } from '../utils/StudioSynthAudio';

export interface DAWTrack {
  id: string;
  name: string;
  category: InstrumentCategory;
  preset?: SynthPreset;
  color: string;
  icon: string;
  isMuted: boolean;
  isSolo: boolean;
  isArmed: boolean;
  volume: number;
  events: NoteEvent[];
}

export interface LogicProject {
  id: string;
  name: string;
  bpm: number;
  timeSignature: string;
  updatedAt: string;
  tracks: DAWTrack[];
  masterSettings: MasterPluginSettings;
}

const DEFAULT_PROJECTS: LogicProject[] = [
  {
    id: 'proj-neural-anthem',
    name: 'Neural OS Anthem (Cyber Trap)',
    bpm: 130,
    timeSignature: '4/4',
    updatedAt: 'Hoje, 21:30',
    masterSettings: {
      eqLow: 3,
      eqMid: -1,
      eqHigh: 4,
      compThreshold: -14,
      compRatio: 4,
      compAttack: 0.01,
      compRelease: 0.2,
      compMakeup: 3,
      lufsTarget: -14,
      limiterCeiling: -0.1,
      enabled: true,
    },
    tracks: [
      {
        id: 'tr-drums',
        name: 'PUB 808 Trap Kit',
        category: 'drums',
        color: '#ef4444',
        icon: '🥁',
        isMuted: false,
        isSolo: false,
        isArmed: false,
        volume: 0.9,
        events: [
          { id: '1', noteOrPiece: 'kick', time: 0.0, duration: 0.2 },
          { id: '2', noteOrPiece: 'hihat_closed', time: 0.23, duration: 0.1 },
          { id: '3', noteOrPiece: 'snare', time: 0.46, duration: 0.2 },
          { id: '4', noteOrPiece: 'hihat_closed', time: 0.69, duration: 0.1 },
          { id: '5', noteOrPiece: 'kick', time: 0.92, duration: 0.2 },
          { id: '6', noteOrPiece: 'hihat_open', time: 1.15, duration: 0.2 },
          { id: '7', noteOrPiece: 'snare', time: 1.38, duration: 0.2 },
          { id: '8', noteOrPiece: 'crash', time: 0.0, duration: 0.8 },
        ],
      },
      {
        id: 'tr-bass',
        name: 'Moog Sub Bass Lead',
        category: 'synth',
        preset: 'moog_bass',
        color: '#8b5cf6',
        icon: '⚡',
        isMuted: false,
        isSolo: false,
        isArmed: false,
        volume: 0.85,
        events: [
          { id: 'b1', noteOrPiece: 'C2', freq: 65.41, time: 0.0, duration: 0.4 },
          { id: 'b2', noteOrPiece: 'Eb2', freq: 77.78, time: 0.46, duration: 0.4 },
          { id: 'b3', noteOrPiece: 'F2', freq: 87.31, time: 0.92, duration: 0.4 },
          { id: 'b4', noteOrPiece: 'G2', freq: 98.0, time: 1.38, duration: 0.4 },
        ],
      },
      {
        id: 'tr-synth',
        name: 'SuperSaw Poly Lead',
        category: 'synth',
        preset: 'supersaw_lead',
        color: '#06b6d4',
        icon: '🎛️',
        isMuted: false,
        isSolo: false,
        isArmed: true,
        volume: 0.75,
        events: [
          { id: 's1', noteOrPiece: 'C4', freq: 261.63, time: 0.0, duration: 0.3 },
          { id: 's2', noteOrPiece: 'Eb4', freq: 311.13, time: 0.23, duration: 0.3 },
          { id: 's3', noteOrPiece: 'G4', freq: 392.0, time: 0.46, duration: 0.3 },
          { id: 's4', noteOrPiece: 'Bb4', freq: 466.16, time: 0.69, duration: 0.4 },
        ],
      },
    ],
  },
];

interface Props {
  onClose: () => void;
}

export const LogicProDawModal: React.FC<Props> = ({ onClose }) => {
  // Estado de Navegação: 'chooser' (Dashboard Logic Pro) | 'daw' (Pure DAW multitrack)
  const [viewMode, setViewMode] = useState<'chooser' | 'daw'>('chooser');
  const [activeProject, setActiveProject] = useState<LogicProject>(DEFAULT_PROJECTS[0]);
  const [recentProjects, setRecentProjects] = useState<LogicProject[]>(DEFAULT_PROJECTS);

  // New Project Form
  const [newProjectName, setNewProjectName] = useState('Novo Projeto Sem Título');
  const [newProjectBpm, setNewProjectBpm] = useState(128);

  // Modal para Adicionar Track Multiseleção
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [selectedInstTypes, setSelectedInstTypes] = useState<InstrumentCategory[]>(['synth']);
  const [selectedPreset, setSelectedPreset] = useState<SynthPreset>('moog_bass');

  // DAW Playback & Live Recording State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [armedTrackId, setArmedTrackId] = useState<string>('tr-synth');
  const [isMasterBusOpen, setIsMasterBusOpen] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);

  // Live meters
  const [meterLevels, setMeterLevels] = useState<{ peak: number; lufsEst: number }>({ peak: -60, lufsEst: -60 });

  // Referência do relógio de gravação
  const recordStartTimeRef = useRef<number>(0);
  const playheadIntervalRef = useRef<any>(null);

  // Carregar projetos do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('PUB_LOGIC_PRO_PROJECTS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentProjects(parsed);
          setActiveProject(parsed[0]);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar projetos do Logic Pro:', e);
    }
  }, []);

  // Loop de atualização do medidor de LUFS & True Peak
  useEffect(() => {
    const meterInterval = setInterval(() => {
      if (viewMode === 'daw') {
        setMeterLevels(studioSynthAudio.getMeterLevel());
      }
    }, 120);
    return () => clearInterval(meterInterval);
  }, [viewMode]);

  // Salvar no localStorage
  const saveProjects = (projs: LogicProject[]) => {
    setRecentProjects(projs);
    try {
      localStorage.setItem('PUB_LOGIC_PRO_PROJECTS', JSON.stringify(projs));
    } catch (e) {
      console.warn(e);
    }
  };

  // Abrir DAW pura com novo projeto
  const handleCreateNewProject = () => {
    const newProj: LogicProject = {
      id: 'proj-' + Date.now(),
      name: newProjectName.trim() || 'Projeto Studio ' + (recentProjects.length + 1),
      bpm: newProjectBpm,
      timeSignature: '4/4',
      updatedAt: 'Criado agora',
      masterSettings: { ...studioSynthAudio.masterSettings },
      tracks: [
        {
          id: 'tr-init-keys',
          name: 'Classic Grand Piano',
          category: 'keys',
          color: '#38bdf8',
          icon: '🎹',
          isMuted: false,
          isSolo: false,
          isArmed: true,
          volume: 0.85,
          events: [],
        },
      ],
    };
    const updated = [newProj, ...recentProjects];
    saveProjects(updated);
    setActiveProject(newProj);
    setArmedTrackId(newProj.tracks[0].id);
    setViewMode('daw');
  };

  // Abrir projeto existente
  const handleOpenProject = (proj: LogicProject) => {
    setActiveProject(proj);
    if (proj.tracks.length > 0) {
      const armed = proj.tracks.find((t) => t.isArmed) || proj.tracks[0];
      setArmedTrackId(armed.id);
    }
    setViewMode('daw');
  };

  // Controle de Playhead & Reprodução Multitrack
  useEffect(() => {
    if (isPlaying) {
      const startTime = Date.now() - currentTimeSec * 1000;
      playheadIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const totalDuration = (60 / activeProject.bpm) * 4 * 4; // 4 compassos
        if (elapsed >= totalDuration) {
          // Loop contínuo
          setCurrentTimeSec(0);
        } else {
          setCurrentTimeSec(elapsed);
        }
      }, 30);
    } else {
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
    }
    return () => {
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
    };
  }, [isPlaying, activeProject.bpm, currentTimeSec]);

  // Adicionar Múltiplas Tracks ao mesmo tempo
  const handleAddMultipleTracks = () => {
    const newTracks: DAWTrack[] = [...activeProject.tracks];

    selectedInstTypes.forEach((cat) => {
      const count = newTracks.filter((t) => t.category === cat).length + 1;
      let name = '';
      let icon = '🎵';
      let color = '#38bdf8';

      if (cat === 'drums') {
        name = 'Acoustic / Trap Drums ' + count;
        icon = '🥁';
        color = '#ef4444';
      } else if (cat === 'keys') {
        name = 'Grand Piano ' + count;
        icon = '🎹';
        color = '#38bdf8';
      } else if (cat === 'guitar') {
        name = 'Electric Guitar ' + count;
        icon = '🎸';
        color = '#f59e0b';
      } else if (cat === 'sax') {
        name = 'Vocal Saxophone ' + count;
        icon = '🎷';
        color = '#10b981';
      } else if (cat === 'percussion') {
        name = 'Latin Percussion ' + count;
        icon = '🪘';
        color = '#ec4899';
      } else if (cat === 'synth') {
        const pNames: Record<SynthPreset, string> = {
          moog_bass: 'Minimoog Fat Bass',
          juno_pad: 'Juno-106 Analog Pad',
          dx7_epiano: 'Yamaha DX7 FM Keys',
          '808_sub': 'Boom 808 Sub',
          supersaw_lead: 'JP-8000 SuperSaw Lead',
          pluck_synth: 'Pluck Arp Synth',
        };
        name = (pNames[selectedPreset] || 'Analog Synth') + ' ' + count;
        icon = '⚡';
        color = '#8b5cf6';
      }

      newTracks.push({
        id: 'tr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name,
        category: cat,
        preset: cat === 'synth' ? selectedPreset : undefined,
        color,
        icon,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        volume: 0.8,
        events: [],
      });
    });

    const updatedProj = { ...activeProject, tracks: newTracks };
    setActiveProject(updatedProj);
    setIsAddTrackOpen(false);
  };

  // Tocar e Gravar Performance ao Vivo
  const triggerLivePerformance = (noteOrPiece: string, freq?: number) => {
    // 1. Tocar com ZERO LATÊNCIA imediata
    const armedTrack = activeProject.tracks.find((t) => t.id === armedTrackId);
    const cat = armedTrack ? armedTrack.category : 'keys';

    if (cat === 'drums') {
      studioSynthAudio.triggerDrum(noteOrPiece as DrumComponent);
    } else if (cat === 'guitar' && freq) {
      studioSynthAudio.playGuitar(freq);
    } else if (cat === 'sax' && freq) {
      studioSynthAudio.playSaxophone(freq);
    } else if (cat === 'percussion') {
      studioSynthAudio.triggerPercussion(noteOrPiece as any);
    } else if (cat === 'synth' && freq) {
      studioSynthAudio.playSynth(freq, armedTrack?.preset || 'supersaw_lead');
    } else if (freq) {
      studioSynthAudio.playPiano(freq);
    }

    // 2. Se estiver no modo GRAVAÇÃO (Rec), registrar o evento na track armada
    if (isRecording && armedTrack) {
      const timeInSec = currentTimeSec;
      const newEvent: NoteEvent = {
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        noteOrPiece,
        freq,
        time: timeInSec,
        duration: 0.35,
      };

      const updatedTracks = activeProject.tracks.map((t) => {
        if (t.id === armedTrack.id) {
          return { ...t, events: [...t.events, newEvent] };
        }
        return t;
      });

      setActiveProject({ ...activeProject, tracks: updatedTracks });
    }
  };

  // Quantizador de Gravação (Ajusta todas as notas para a grade de 1/16 do BPM)
  const handleQuantizeTrack = (trackId: string) => {
    const stepDuration = 60 / activeProject.bpm / 4; // 1/16 step

    const updatedTracks = activeProject.tracks.map((t) => {
      if (t.id === trackId) {
        const quantizedEvents = t.events.map((evt) => {
          const nearestStep = Math.round(evt.time / stepDuration);
          const quantizedTime = Math.max(0, nearestStep * stepDuration);
          return { ...evt, time: quantizedTime };
        });
        return { ...t, events: quantizedEvents };
      }
      return t;
    });

    setActiveProject({ ...activeProject, tracks: updatedTracks });
  };

  // Bounce em WAV de Alta Resolução
  const handleBounceWav = async () => {
    setIsBouncing(true);
    try {
      const wavBlob = await studioSynthAudio.exportToWav(
        activeProject.tracks.map((t) => ({
          category: t.category,
          preset: t.preset,
          events: t.events,
        })),
        activeProject.bpm,
        4
      );

      const url = URL.createObjectURL(wavBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = activeProject.name.replace(/\\s+/g, '_') + '_LogicProMaster_PUBREC.wav';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Falha ao exportar WAV:', err);
    } finally {
      setIsBouncing(false);
    }
  };

  // Teclas para o Teclado/Synth integrado
  const pianoKeys = [
    { note: 'C4', label: 'C', freq: 261.63, isBlack: false, key: 'A' },
    { note: 'C#4', label: 'C#', freq: 277.18, isBlack: true, key: 'W' },
    { note: 'D4', label: 'D', freq: 293.66, isBlack: false, key: 'S' },
    { note: 'D#4', label: 'D#', freq: 311.13, isBlack: true, key: 'E' },
    { note: 'E4', label: 'E', freq: 329.63, isBlack: false, key: 'D' },
    { note: 'F4', label: 'F', freq: 349.23, isBlack: false, key: 'F' },
    { note: 'F#4', label: 'F#', freq: 369.99, isBlack: true, key: 'T' },
    { note: 'G4', label: 'G', freq: 392.0, isBlack: false, key: 'G' },
    { note: 'G#4', label: 'G#', freq: 415.3, isBlack: true, key: 'Y' },
    { note: 'A4', label: 'A', freq: 440.0, isBlack: false, key: 'H' },
    { note: 'A#4', label: 'A#', freq: 466.16, isBlack: true, key: 'U' },
    { note: 'B4', label: 'B', freq: 493.88, isBlack: false, key: 'J' },
    { note: 'C5', label: 'C5', freq: 523.25, isBlack: false, key: 'K' },
  ];

  // Atalhos de teclado para tocar ao vivo
  useEffect(() => {
    if (viewMode !== 'daw') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
        return;
      }

      const matchKey = pianoKeys.find((k) => k.key.toUpperCase() === e.key.toUpperCase());
      if (matchKey) {
        triggerLivePerformance(matchKey.note, matchKey.freq);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, armedTrackId, isRecording, currentTimeSec, activeProject]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 13, 0.96)',
        backdropFilter: 'blur(20px)',
        zIndex: 25000000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        color: '#e2e8f0',
      }}
    >
      {/* HEADER SUPERIOR ESTILO APPLE LOGIC PRO */}
      <div
        style={{
          height: '48px',
          background: 'linear-gradient(180deg, #24272c 0%, #17181c 100%)',
          borderBottom: '1px solid #333842',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onClose}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#ff5f56',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Fechar DAW"
            />
            <button
              onClick={() => setViewMode(viewMode === 'chooser' ? 'daw' : 'chooser')}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#ffbd2e',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Alternar Dashboard / DAW"
            />
            <button
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#27c93f',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Maximizar"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎛️</span>
            <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.02em', color: '#f8fafc' }}>
              PUB DAW
            </span>
            <span
              style={{
                background: '#0284c7',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              Zero Latency Engine
            </span>
          </div>
        </div>

        {/* NOME DO PROJETO & DISPLAY CENTRAL DO LOGIC PRO */}
        {viewMode === 'daw' && (
          <div
            style={{
              background: '#0d0f12',
              border: '1px solid #2e3440',
              borderRadius: '6px',
              padding: '4px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase' }}>PROJETO</span>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>{activeProject.name}</span>
            </div>
            <div style={{ width: '1px', height: '22px', background: '#334155' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '9px' }}>TEMPO</span>
              <span style={{ color: '#4ade80', fontWeight: 800 }}>{activeProject.bpm} BPM</span>
            </div>
            <div style={{ width: '1px', height: '22px', background: '#334155' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '9px' }}>TIME</span>
              <span style={{ color: '#facc15', fontWeight: 800 }}>
                {Math.floor(currentTimeSec / 60)}:{(currentTimeSec % 60).toFixed(2).padStart(5, '0')}
              </span>
            </div>
          </div>
        )}

        {/* CONTROLES DA BARRA DIREITA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {viewMode === 'daw' && (
            <>
              <button
                onClick={() => setIsMasterBusOpen(!isMasterBusOpen)}
                style={{
                  background: isMasterBusOpen ? '#0284c7' : '#1e293b',
                  color: '#fff',
                  border: '1px solid #38bdf8',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🎚️ Master Bus Plugin</span>
              </button>

              <button
                onClick={handleBounceWav}
                disabled={isBouncing}
                style={{
                  background: isBouncing ? '#64748b' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: isBouncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
                }}
              >
                <span>{isBouncing ? '⏳ Exportando WAV...' : '💾 Bounce WAV 24-Bit'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => setViewMode(viewMode === 'chooser' ? 'daw' : 'chooser')}
            style={{
              background: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {viewMode === 'chooser' ? 'Ir para a DAW' : '📁 Projetos'}
          </button>

          <button
            onClick={onClose}
            title="Fechar Logic Pro DAW"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>✕ Fechar</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DASHBOARD INICIAL ESTILO LOGIC PRO (PROJECT CHOOSER & RECENT PROJECTS) */}
      {/* ========================================================================= */}
      {viewMode === 'chooser' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '40px 60px',
            display: 'flex',
            flexDirection: 'column',
            gap: '30px',
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
              PUB DAW • Hub de Criação Musical
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
              Crie um novo projeto multitrack puro com latência zero ou continue uma produção recente da Pub Core Holding.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '30px' }}>
            {/* CRIAR NOVO PROJETO (DAW PURA) */}
            <div
              style={{
                background: 'linear-gradient(145deg, #181a20 0%, #111317 100%)',
                border: '1px solid #2d313a',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '26px' }}>✨</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#f8fafc' }}>
                    Criar Novo Projeto
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Abre a DAW pura vazia para gravação</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Nome do Projeto
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={{
                    background: '#090a0f',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                  placeholder="Ex: Novo Hit Trap PUB"
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    BPM ({newProjectBpm})
                  </label>
                  <input
                    type="range"
                    min="60"
                    max="190"
                    value={newProjectBpm}
                    onChange={(e) => setNewProjectBpm(Number(e.target.value))}
                    style={{ accentColor: '#0284c7' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Fórmula
                  </label>
                  <span style={{ padding: '8px 12px', background: '#090a0f', borderRadius: '8px', fontSize: '12px' }}>
                    4/4
                  </span>
                </div>
              </div>

              <button
                onClick={handleCreateNewProject}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '10px',
                  boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
                }}
              >
                <span>➕ Abrir DAW Pura (Novo Projeto)</span>
              </button>
            </div>

            {/* PROJETOS RECENTES */}
            <div
              style={{
                background: 'linear-gradient(145deg, #181a20 0%, #111317 100%)',
                border: '1px solid #2d313a',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>📂</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#f8fafc' }}>
                      Projetos Recentes
                    </h3>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Trabalhos salvos na estação</span>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>
                  {recentProjects.length} Projetos
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                {recentProjects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => handleOpenProject(proj)}
                    style={{
                      background: activeProject.id === proj.id ? '#1e293b' : '#0e1117',
                      border: activeProject.id === proj.id ? '1px solid #38bdf8' : '1px solid #1f242e',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#f8fafc' }}>{proj.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {proj.tracks.length} Tracks • {proj.bpm} BPM • {proj.updatedAt}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProject(proj);
                      }}
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Abrir ▶
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DAW MULTITRACK PURA ESTILO LOGIC PRO                                   */}
      {/* ========================================================================= */}
      {viewMode === 'daw' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* BARRA DE TRANSPORTE & GRAVAÇÃO AO VIVO */}
          <div
            style={{
              height: '52px',
              background: '#131519',
              borderBottom: '1px solid #232730',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
            }}
          >
            {/* PLAY, STOP, REC, QUANTIZE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  setCurrentTimeSec(0);
                  setIsPlaying(false);
                  setIsRecording(false);
                }}
                style={{
                  background: '#1f242e',
                  border: '1px solid #333d4b',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
                title="Voltar ao Início"
              >
                ⏮
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: isPlaying ? '#eab308' : '#10b981',
                  border: 'none',
                  color: '#000',
                  borderRadius: '6px',
                  padding: '7px 18px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play (Espaço)'}
              </button>

              <button
                onClick={() => {
                  if (!isRecording) {
                    setIsPlaying(true);
                    setIsRecording(true);
                    recordStartTimeRef.current = Date.now();
                  } else {
                    setIsRecording(false);
                  }
                }}
                style={{
                  background: isRecording ? '#ef4444' : '#3f1515',
                  border: isRecording ? '2px solid #f87171' : '1px solid #ef4444',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isRecording ? '0 0 15px #ef4444' : 'none',
                }}
              >
                <span>🔴</span>
                <span>{isRecording ? 'Gravando...' : 'Gravar Rec'}</span>
              </button>

              <button
                onClick={() => handleQuantizeTrack(armedTrackId)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Quantizar eventos da track armada para o BPM perfeito"
              >
                <span>⚡ Quantize (Q)</span>
              </button>
            </div>

            {/* SELEÇÃO E CRIAÇÃO DE TRACKS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setIsAddTrackOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>➕ Criar Track (Multi-Instrumento)</span>
              </button>
            </div>
          </div>

          {/* ÁREA PRINCIPAL MULTITRACK & TIMELINE */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* CABEÇALHOS DAS TRACKS (CANAL ESQUERDO) */}
            <div
              style={{
                width: '320px',
                background: '#16191f',
                borderRight: '1px solid #282e3b',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }}
            >
              {activeProject.tracks.map((track) => {
                const isArmed = track.id === armedTrackId;
                return (
                  <div
                    key={track.id}
                    onClick={() => setArmedTrackId(track.id)}
                    style={{
                      height: '76px',
                      background: isArmed ? '#1f2633' : '#14171d',
                      borderBottom: '1px solid #242934',
                      borderLeft: '4px solid ' + track.color,
                      padding: '8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>{track.icon}</span>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '12px', color: '#f8fafc' }}>
                            {track.name}
                          </span>
                          <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>
                            {track.category.toUpperCase()} {track.preset ? '• ' + track.preset : ''}
                          </span>
                        </div>
                      </div>

                      {/* BADGE DE ARME / GRAVAÇÃO */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setArmedTrackId(track.id);
                        }}
                        style={{
                          background: isArmed ? '#ef4444' : '#27272a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          width: '22px',
                          height: '22px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                        title="Armar para Gravação"
                      >
                        R
                      </button>
                    </div>

                    {/* CONTROLES: MUTE, SOLO, VOLUME */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = activeProject.tracks.map((t) =>
                            t.id === track.id ? { ...t, isMuted: !t.isMuted } : t
                          );
                          setActiveProject({ ...activeProject, tracks: updated });
                        }}
                        style={{
                          background: track.isMuted ? '#ef4444' : '#242934',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          cursor: 'pointer',
                        }}
                      >
                        M
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = activeProject.tracks.map((t) =>
                            t.id === track.id ? { ...t, isSolo: !t.isSolo } : t
                          );
                          setActiveProject({ ...activeProject, tracks: updated });
                        }}
                        style={{
                          background: track.isSolo ? '#eab308' : '#242934',
                          color: track.isSolo ? '#000' : '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          cursor: 'pointer',
                        }}
                      >
                        S
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={track.volume}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const updated = activeProject.tracks.map((t) =>
                            t.id === track.id ? { ...t, volume: val } : t
                          );
                          setActiveProject({ ...activeProject, tracks: updated });
                        }}
                        style={{ width: '80px', accentColor: track.color }}
                      />
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{Math.round(track.volume * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* TIMELINE & REGIÕES MIDI / EVENTOS GRAVADOS */}
            <div
              style={{
                flex: 1,
                background: '#0d1017',
                position: 'relative',
                overflowX: 'auto',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* LINHA DE COMPASSO SUPERIOR */}
              <div
                style={{
                  height: '24px',
                  background: '#12161f',
                  borderBottom: '1px solid #232a38',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                  <div
                    key={bar}
                    style={{
                      width: '120px',
                      borderRight: '1px solid #1f2633',
                      fontSize: '10px',
                      color: '#64748b',
                      paddingLeft: '6px',
                      fontFamily: 'monospace',
                    }}
                  >
                    Compasso {bar}
                  </div>
                ))}
              </div>

              {/* CURSOR PLAYHEAD VERMELHO EM TEMPO REAL */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 320 + currentTimeSec * 80 + 'px',
                  width: '2px',
                  background: '#ef4444',
                  boxShadow: '0 0 8px #ef4444',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              />

              {/* PISTAS DE NOTAS DE CADA TRACK */}
              {activeProject.tracks.map((track) => (
                <div
                  key={track.id}
                  style={{
                    height: '76px',
                    borderBottom: '1px solid #1a202c',
                    position: 'relative',
                    background:
                      track.id === armedTrackId
                        ? 'repeating-linear-gradient(90deg, #10141d, #10141d 29px, #161b26 30px)'
                        : 'repeating-linear-gradient(90deg, #0a0d13, #0a0d13 29px, #10141b 30px)',
                  }}
                >
                  {track.events.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        position: 'absolute',
                        left: evt.time * 80 + 'px',
                        top: '16px',
                        height: '42px',
                        width: Math.max(28, evt.duration * 80) + 'px',
                        background: track.color,
                        borderRadius: '4px',
                        padding: '4px 6px',
                        color: '#000',
                        fontWeight: 800,
                        fontSize: '10px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {evt.noteOrPiece}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* INSTRUMENTO VIRTUAL INTERATIVO AO VIVO (TOUCH & TECLADO DO COMPUTADOR)     */}
          {/* ========================================================================= */}
          <div
            style={{
              height: '210px',
              background: '#12141a',
              borderTop: '2px solid #232834',
              padding: '12px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🎹</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}>
                  TECLADO & INSTRUMENTO VIRTUAL AO VIVO (ZERO LATÊNCIA)
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Use as teclas [A, W, S, E, D, F, T, G, Y, H, U, J, K] do seu teclado físico
                </span>
              </div>

              {/* MEDIDORES DE MASTER PEAK & ESTIMATIVA LUFS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', fontFamily: 'monospace' }}>
                <div>
                  <span style={{ color: '#64748b' }}>PEAK: </span>
                  <span style={{ color: meterLevels.peak > -1 ? '#ef4444' : '#4ade80', fontWeight: 800 }}>
                    {meterLevels.peak} dB
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>LUFS: </span>
                  <span style={{ color: '#38bdf8', fontWeight: 800 }}>{meterLevels.lufsEst} LUFS</span>
                </div>
              </div>
            </div>

            {/* TECLADO DE PIANO C4 A C5 INTEGRADO */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                flex: 1,
                background: '#09090b',
                padding: '8px',
                borderRadius: '10px',
                border: '1px solid #27272a',
                userSelect: 'none',
              }}
            >
              {pianoKeys
                .filter((k) => !k.isBlack)
                .map((whiteKey) => (
                  <div
                    key={whiteKey.note}
                    onMouseDown={() => triggerLivePerformance(whiteKey.note, whiteKey.freq)}
                    style={{
                      flex: 1,
                      height: '100%',
                      background: 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%)',
                      borderRadius: '0 0 6px 6px',
                      margin: '0 2px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      paddingBottom: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '12px' }}>{whiteKey.label}</span>
                    <span style={{ color: '#64748b', fontSize: '9px', fontWeight: 700 }}>[{whiteKey.key}]</span>
                  </div>
                ))}

              {[
                { note: 'C#4', label: 'C#', freq: 277.18, left: '8.5%', key: 'W' },
                { note: 'D#4', label: 'D#', freq: 311.13, left: '21.5%', key: 'E' },
                { note: 'F#4', label: 'F#', freq: 369.99, left: '46.5%', key: 'T' },
                { note: 'G#4', label: 'G#', freq: 415.3, left: '59.5%', key: 'Y' },
                { note: 'A#4', label: 'A#', freq: 466.16, left: '72.5%', key: 'U' },
              ].map((blackKey) => (
                <div
                  key={blackKey.note}
                  onMouseDown={() => triggerLivePerformance(blackKey.note, blackKey.freq)}
                  style={{
                    position: 'absolute',
                    left: blackKey.left,
                    width: '6.5%',
                    height: '62%',
                    background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
                    borderRadius: '0 0 4px 4px',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                  }}
                >
                  <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '10px' }}>{blackKey.label}</span>
                  <span style={{ color: '#94a3b8', fontSize: '8px' }}>[{blackKey.key}]</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL DE ADICIONAR TRACKS COM MÚLTIPLA SELEÇÃO DE INSTRUMENTOS         */}
      {/* ========================================================================= */}
      {isAddTrackOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30000000,
          }}
          onClick={() => setIsAddTrackOpen(false)}
        >
          <div
            style={{
              background: '#1a1d24',
              borderRadius: '16px',
              border: '1px solid #333d4b',
              width: '540px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                Nova Track • Seleção Múltipla de Instrumentos
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Selecione um ou vários instrumentos virtuais para criar faixas simultâneas
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { id: 'drums', label: 'Bateria', icon: '🥁' },
                { id: 'keys', label: 'Teclado / Piano', icon: '🎹' },
                { id: 'guitar', label: 'Guitarra', icon: '🎸' },
                { id: 'sax', label: 'Saxofone', icon: '🎷' },
                { id: 'percussion', label: 'Percussão', icon: '🪘' },
                { id: 'synth', label: 'Sintetizador', icon: '⚡' },
              ].map((inst) => {
                const isSelected = selectedInstTypes.includes(inst.id as InstrumentCategory);
                return (
                  <button
                    key={inst.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedInstTypes(selectedInstTypes.filter((x) => x !== inst.id));
                      } else {
                        setSelectedInstTypes([...selectedInstTypes, inst.id as InstrumentCategory]);
                      }
                    }}
                    style={{
                      background: isSelected ? '#0284c7' : '#12141a',
                      border: isSelected ? '2px solid #38bdf8' : '2px solid #272d38',
                      borderRadius: '10px',
                      padding: '14px 10px',
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{inst.icon}</span>
                    <span>{inst.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedInstTypes.includes('synth') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Preset do Sintetizador Lendário:
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value as SynthPreset)}
                  style={{
                    background: '#090a0f',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="moog_bass">Moog Minimoog (Fat Bass)</option>
                  <option value="juno_pad">Roland Juno-106 (Analog Lush Chorus Pad)</option>
                  <option value="dx7_epiano">Yamaha DX7 (FM Electric Piano)</option>
                  <option value="808_sub">Roland TR-808 (Sub Bass Boom)</option>
                  <option value="supersaw_lead">Roland JP-8000 (SuperSaw EDM Lead)</option>
                  <option value="pluck_synth">Modern Pluck Arp</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setIsAddTrackOpen(false)}
                style={{
                  background: '#272d38',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >
                Cancelar
              </button>

              <button
                onClick={handleAddMultipleTracks}
                disabled={selectedInstTypes.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 20px',
                  cursor: selectedInstTypes.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  fontSize: '12px',
                }}
              >
                Criar {selectedInstTypes.length} Faixa(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PLUGIN MASTER BUS (EQ, COMPRESSOR, LUFS STABILIZER & LIMITER)           */}
      {/* ========================================================================= */}
      {isMasterBusOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '220px',
            right: '20px',
            width: '420px',
            background: 'linear-gradient(145deg, #181c24 0%, #101319 100%)',
            borderRadius: '14px',
            border: '2px solid #0284c7',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 25px rgba(2, 132, 199, 0.3)',
            zIndex: 26000000,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🎚️</span>
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#f8fafc' }}>
                MASTER BUS • CADEIA DE SINAL PROFISSIONAL
              </span>
            </div>
            <button
              onClick={() => setIsMasterBusOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              ✕
            </button>
          </div>

          {/* 1. EQ PARAMÉTRICO DE 3 BANDAS */}
          <div style={{ background: '#0a0d13', borderRadius: '8px', padding: '10px', border: '1px solid #232a38' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>1. EQ PARAMÉTRICO DE 3 BANDAS</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
              <div>
                <label style={{ fontSize: '9px', color: '#64748b' }}>LOW (100Hz)</label>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  value={studioSynthAudio.masterSettings.eqLow}
                  onChange={(e) => studioSynthAudio.updateMasterSettings({ eqLow: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '9px', color: '#64748b' }}>MID (1.5kHz)</label>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  value={studioSynthAudio.masterSettings.eqMid}
                  onChange={(e) => studioSynthAudio.updateMasterSettings({ eqMid: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '9px', color: '#64748b' }}>HIGH (8kHz)</label>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  value={studioSynthAudio.masterSettings.eqHigh}
                  onChange={(e) => studioSynthAudio.updateMasterSettings({ eqHigh: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>
            </div>
          </div>

          {/* 2. COMPRESSOR ÓPTICO / VCA */}
          <div style={{ background: '#0a0d13', borderRadius: '8px', padding: '10px', border: '1px solid #232a38' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#4ade80' }}>2. COMPRESSOR GLUE MASTER</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '6px' }}>
              <div>
                <label style={{ fontSize: '9px', color: '#64748b' }}>THRESHOLD (-30 a 0 dB)</label>
                <input
                  type="range"
                  min="-30"
                  max="0"
                  value={studioSynthAudio.masterSettings.compThreshold}
                  onChange={(e) => studioSynthAudio.updateMasterSettings({ compThreshold: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#4ade80' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '9px', color: '#64748b' }}>RATIO (1:1 a 10:1)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={studioSynthAudio.masterSettings.compRatio}
                  onChange={(e) => studioSynthAudio.updateMasterSettings({ compRatio: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#4ade80' }}
                />
              </div>
            </div>
          </div>

          {/* 3. ESTABILIZADOR E LIMITER DE LUFS */}
          <div style={{ background: '#0a0d13', borderRadius: '8px', padding: '10px', border: '1px solid #232a38' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#eab308' }}>
                3. TRUE PEAK LIMITER & ESTABILIZADOR LUFS
              </span>
              <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 700 }}>CEILING: -0.1 dB</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Pico Real Instantâneo:</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>
                {meterLevels.peak} dBFS
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Alvo Streaming Spotify/Apple:</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#facc15' }}>
                -14.0 LUFS Integrado
              </span>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};