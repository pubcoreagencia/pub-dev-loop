import React from 'react';

export interface VinylAlbum {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: string;
  labelColor: string;
  coverBg: string;
  description: string;
  tracks: string[];
}

export const VINYL_ALBUMS: VinylAlbum[] = [
  {
    id: 'album-synth',
    title: 'Midnight Compile Session',
    artist: 'Neon Workforce',
    genre: 'Synthwave & Retrowave',
    year: '1984 / 2026',
    labelColor: '#38bdf8',
    coverBg: 'linear-gradient(135deg, #0284c7, #1e1b4b)',
    description: 'Batidas analógicas aceleradas para maratonas de código e deploy sem medo nas madrugadas.',
    tracks: ['01. Hotfix at 3 AM', '02. Cyberpunk Terminal', '03. Stack Overflow Highway', '04. Fast Forward Commit'],
  },
  {
    id: 'album-bossa',
    title: 'Bossa Nova for Code Reviewers',
    artist: 'Arthur Vance Trio',
    genre: 'Bossa Jazz & Soft Lounge',
    year: '1962 / 2026',
    labelColor: '#f59e0b',
    coverBg: 'linear-gradient(135deg, #d97706, #451a03)',
    description: 'Violão clássico e piano suave selecionados pelo Dr. Arthur para manter a calma durante reuniões de alinhamento.',
    tracks: ['01. Garota de Copacabana', '02. Café na Porcelana', '03. Cronograma Perfeito', '04. Paz na Sprint'],
  },
  {
    id: 'album-idm',
    title: 'Zero Any in TypeScript',
    artist: 'Helena & The Solid State',
    genre: 'IDM Minimal & Glitch',
    year: '2026',
    labelColor: '#3b82f6',
    coverBg: 'linear-gradient(135deg, #2563eb, #0f172a)',
    description: 'Texturas sonoras limpas e minimalistas para quem não tolera acoplamento ou falta de rigor arquitetural.',
    tracks: ['01. Pure Abstraction', '02. Monad Dreams', '03. Strict Null Check', '04. Hexagonal Architecture'],
  },
  {
    id: 'album-rock',
    title: 'Friday 17:59 Production Deploy',
    artist: 'Crash Silveira Band',
    genre: 'Speed Metal & Pop Punk',
    year: '2026',
    labelColor: '#ef4444',
    coverBg: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
    description: 'Guitarras pesadas e riffs rápidos que o Lucas ouve no volume máximo enquanto jura que o commit vai passar no build.',
    tracks: ['01. Works on My Machine', '02. Force Push Hero', '03. Last Minute Hotfix', '04. No Tests No Fear'],
  },
  {
    id: 'album-8bit',
    title: 'Duck in the Database',
    artist: 'Chaos Monkey & Tiago',
    genre: '8-Bit Chiptune & Electro',
    year: '1989 / 2026',
    labelColor: '#eab308',
    coverBg: 'linear-gradient(135deg, #ca8a04, #14532d)',
    description: 'Músicas no estilo Game Boy e arcade criadas pelo Tiago para acompanhar os testes destrutivos com sua frota de patinhos.',
    tracks: ['01. Rubber Duck Symphony', '02. Fuzzing the Payload', '03. 500 Internal Server Error', '04. Chaos Monkey Dance'],
  },
  {
    id: 'album-lofi',
    title: 'Matcha & Memory Leaks',
    artist: 'Sentinel Beatriz',
    genre: 'Dark Lo-Fi Chillhop',
    year: '2026',
    labelColor: '#10b981',
    coverBg: 'linear-gradient(135deg, #059669, #064e3b)',
    description: 'Batidas relaxantes e hipnóticas que a Beatriz escuta enquanto encontra vulnerabilidades e memória vazando em segundos.',
    tracks: ['01. Green Tea Filter', '02. Zero Day Chill', '03. Blocked Pull Request', '04. Safe in Production'],
  },
];

interface VinylJukeboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAlbumId: string;
  onSelectAlbum: (album: VinylAlbum) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const VinylJukeboxModal: React.FC<VinylJukeboxModalProps> = ({
  isOpen,
  onClose,
  selectedAlbumId,
  onSelectAlbum,
  isPlaying,
  onTogglePlay,
}) => {
  if (!isOpen) return null;

  const activeAlbum = VINYL_ALBUMS.find((a) => a.id === selectedAlbumId) || VINYL_ALBUMS[0];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '840px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(56, 189, 248, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO JUKEBOX */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, #1e293b, #0f172a)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px', animation: isPlaying ? 'spin 5s linear infinite' : 'none' }}>
              📻
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>
                THE OFFICE • TOCA-DISCOS &amp; VINIL JUKEBOX
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Selecione o disco de vinil na prateleira do lounge para ambientar o escritório
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* CORPO: PRATELEIRA DE DISCOS + REPRODUTOR ATUAL */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* PAINEL DO DISCO EM REPRODUÇÃO */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              padding: '18px',
              borderRadius: '12px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: `1.5px solid ${activeAlbum.labelColor}`,
              alignItems: 'center',
            }}
          >
            {/* DISCO DE VINIL GIRATÓRIO */}
            <div
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #09090b 20%, #18181b 40%, #09090b 70%, #27272a 100%)',
                border: '3px solid #3f3f46',
                boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                animation: isPlaying ? 'spin 3s linear infinite' : 'none',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: activeAlbum.labelColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '11px',
                }}
              >
                ●
              </div>
            </div>

            {/* INFORMAÇÕES DA FAIXA */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: activeAlbum.labelColor, color: '#000', fontWeight: 700 }}>
                  {activeAlbum.genre}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{activeAlbum.year}</span>
              </div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#f8fafc' }}>
                {activeAlbum.title}
              </h3>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#38bdf8', fontWeight: 600 }}>
                {activeAlbum.artist}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                {activeAlbum.description}
              </p>
            </div>

            {/* BOTÃO DE PLAY / PAUSE NA VITROLA */}
            <button
              onClick={onTogglePlay}
              style={{
                background: isPlaying ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'linear-gradient(135deg, #38bdf8, #0284c7)',
                border: 'none',
                borderRadius: '50%',
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                color: '#000',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                flexShrink: 0,
              }}
              title={isPlaying ? 'Pausar Vitrola' : 'Tocar Disco'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          </div>

          {/* PRATELEIRA DE DISCOS DE VINIL */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📚 PRATELEIRA DE VINIS DO LOUNGE (CLIQUE PARA TOCAR)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {VINYL_ALBUMS.map((album) => {
                const isSelected = album.id === selectedAlbumId;
                return (
                  <div
                    key={album.id}
                    onClick={() => onSelectAlbum(album)}
                    style={{
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                      border: `1.5px solid ${isSelected ? '#38bdf8' : '#334155'}`,
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    {/* CAPA DO DISCO */}
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '6px',
                        background: album.coverBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                        flexShrink: 0,
                      }}
                    >
                      🎵
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{ margin: '0 0 2px 0', fontSize: '13px', color: isSelected ? '#38bdf8' : '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {album.title}
                      </h5>
                      <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {album.artist}
                      </span>
                      <span style={{ fontSize: '10px', color: album.labelColor, fontWeight: 600 }}>
                        {album.genre}
                      </span>
                    </div>

                    {isSelected && (
                      <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>
                        {isPlaying ? 'TOCANDO' : 'PRONTO'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
