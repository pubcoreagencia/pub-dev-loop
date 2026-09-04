import React from 'react';

export interface VinylAlbum {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: string;
  labelColor: string;
  coverBg: string;
  coverImage?: string;
  trackSlug?: string;
  duration?: string;
  description: string;
  tracks: string[];
}

export const PUB_ARTWORK = 'https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg';

export const VINYL_ALBUMS: VinylAlbum[] = [
  {
    id: 'album-pubrecords',
    title: 'PUB Records • Todas as Faixas (Feed Oficial)',
    artist: 'paesnobeat • PUB Records',
    genre: 'SoundCloud Feed',
    year: '2026',
    labelColor: '#ff5500',
    coverBg: 'linear-gradient(135deg, #ff5500, #7c2d12)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/tracks',
    duration: '63 Faixas',
    description: 'Catálogo oficial completo hospedado em soundcloud.com/pubrecords/tracks. Qualquer faixa nova upada entra aqui em tempo real.',
    tracks: ['01. Feed Dinâmico do SoundCloud', '02. Transmissão Contínua', '03. 100% Volume Analógico'],
  },
  {
    id: 'track-mailow',
    title: 'MAILOW',
    artist: 'paesnobeat • PUB Records',
    genre: 'Trap / Beat',
    year: '2026',
    labelColor: '#ef4444',
    coverBg: 'linear-gradient(135deg, #b91c1c, #450a0a)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/mailow',
    duration: '0:59',
    description: 'Faixa oficial lançada no SoundCloud por paesnobeat (PUB Records).',
    tracks: ['01. MAILOW (Original Mix)'],
  },
  {
    id: 'track-pelelope',
    title: 'pelelope',
    artist: 'paesnobeat • PUB Records',
    genre: 'Instrumental Groove',
    year: '2026',
    labelColor: '#f59e0b',
    coverBg: 'linear-gradient(135deg, #d97706, #451a03)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/pelelope',
    duration: '4:00',
    description: 'Faixa com arranjo melódico e batida marcante produzida por paesnobeat.',
    tracks: ['01. pelelope (Original Mix)'],
  },
  {
    id: 'track-carlton',
    title: 'carlton',
    artist: 'paesnobeat • PUB Records',
    genre: 'Extended Session',
    year: '2026',
    labelColor: '#10b981',
    coverBg: 'linear-gradient(135deg, #059669, #064e3b)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/carlton',
    duration: '10:46',
    description: 'Sessão estendida de 10 minutos para foco profundo e desenvolvimento sem pausas.',
    tracks: ['01. carlton (Extended Cut)'],
  },
  {
    id: 'track-sherman-2',
    title: 'sherman #2',
    artist: 'paesnobeat • PUB Records',
    genre: 'Boom Bap',
    year: '2026',
    labelColor: '#38bdf8',
    coverBg: 'linear-gradient(135deg, #0284c7, #082f49)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/sherman-2',
    duration: '1:29',
    description: 'Produção clássica e punchy com a assinatura rítmica da PUB Records.',
    tracks: ['01. sherman #2'],
  },
  {
    id: 'track-jovem-tralha',
    title: 'jovem tralha',
    artist: 'paesnobeat • PUB Records',
    genre: 'Underground Beat',
    year: '2026',
    labelColor: '#8b5cf6',
    coverBg: 'linear-gradient(135deg, #7c3aed, #2e1065)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/jovem-tralha',
    duration: '7:08',
    description: 'Faixa envolvente de 7 minutos gravada no Rio de Janeiro por paesnobeat.',
    tracks: ['01. jovem tralha'],
  },
  {
    id: 'track-sunday-sunday',
    title: 'sunday sunday',
    artist: 'paesnobeat • PUB Records',
    genre: 'Chill / Lo-Fi Beat',
    year: '2026',
    labelColor: '#ec4899',
    coverBg: 'linear-gradient(135deg, #db2777, #500724)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/sunday-sunday',
    duration: '2:27',
    description: 'Batida descontraída para manhãs de domingo e sessões leves de alinhamento.',
    tracks: ['01. sunday sunday'],
  },
  {
    id: 'track-chirivia',
    title: 'chirivia',
    artist: 'paesnobeat • PUB Records',
    genre: 'Original Track',
    year: '2026',
    labelColor: '#14b8a6',
    coverBg: 'linear-gradient(135deg, #0d9488, #042f2e)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/chirivia',
    duration: '4:16',
    description: 'Faixa atmosférica com texturas rítmicas ricas lançada no catálogo oficial.',
    tracks: ['01. chirivia'],
  },
  {
    id: 'track-papara',
    title: 'papara',
    artist: 'paesnobeat • PUB Records',
    genre: 'Groove / Bounce',
    year: '2026',
    labelColor: '#f97316',
    coverBg: 'linear-gradient(135deg, #ea580c, #431407)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/papara',
    duration: '2:49',
    description: 'Balanço rápido e percussão viva produzida por Matheus Paes (paesnobeat).',
    tracks: ['01. papara'],
  },
  {
    id: 'track-balalau',
    title: 'balalau',
    artist: 'paesnobeat • PUB Records',
    genre: 'Rhythm / Vibe',
    year: '2026',
    labelColor: '#eab308',
    coverBg: 'linear-gradient(135deg, #ca8a04, #422006)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/balalau',
    duration: '3:12',
    description: 'Faixa icônica da PUB Records disponível no canal oficial soundcloud.com/pubrecords.',
    tracks: ['01. balalau'],
  },
  {
    id: 'track-padregabriel',
    title: 'PADREGABRIEL',
    artist: 'paesnobeat • PUB Records',
    genre: 'Signature Track',
    year: '2026',
    labelColor: '#6366f1',
    coverBg: 'linear-gradient(135deg, #4f46e5, #1e1b4b)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/padregabriel',
    duration: '3:12',
    description: 'Faixa marcante do catálogo da PUB Records com produção completa de paesnobeat.',
    tracks: ['01. PADREGABRIEL'],
  },
  {
    id: 'album-pubrecords-shuffle',
    title: 'PUB Records • Modo Aleatório (Shuffle)',
    artist: 'paesnobeat • PUB Records',
    genre: 'SoundCloud Shuffle',
    year: '2026',
    labelColor: '#38bdf8',
    coverBg: 'linear-gradient(135deg, #0284c7, #1e1b4b)',
    coverImage: PUB_ARTWORK,
    trackSlug: 'pubrecords/tracks',
    duration: 'Mix Aleatório',
    description: 'Todas as músicas da PUB Records tocadas de forma randômica para ambientar a equipe.',
    tracks: ['01. Shuffle Automático', '02. Rotação Contínua'],
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
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: activeAlbum.labelColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '2px solid #000',
                }}
              >
                {activeAlbum.coverImage ? (
                  <img src={activeAlbum.coverImage} alt={activeAlbum.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#000', fontWeight: 800 }}>●</span>
                )}
              </div>
            </div>

            {/* INFORMAÇÕES DA FAIXA */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: activeAlbum.labelColor, color: '#000', fontWeight: 700 }}>
                  {activeAlbum.genre}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{activeAlbum.duration || activeAlbum.year}</span>
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

          {/* PLAYER OFICIAL DO SOUNDCLOUD DA PUB RECORDS */}
          <div
            style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #ff5500',
              boxShadow: '0 8px 30px rgba(255, 85, 0, 0.15)',
              background: '#181411',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(90deg, #2b1d14, #181411)',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #452416',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>☁️</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff7733', letterSpacing: '0.5px' }}>
                  PUB RECORDS • SOUNDCLOUD ({activeAlbum.title})
                </span>
              </div>
              <a
                href={activeAlbum.trackSlug ? `https://soundcloud.com/${activeAlbum.trackSlug}` : "https://soundcloud.com/pubrecords/tracks"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#ff5500',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Abrir no SoundCloud ↗
              </a>
            </div>
            <iframe
              width="100%"
              height="360"
              scrolling="no"
              frameBorder="no"
              allow="autoplay"
              src={activeAlbum.trackSlug ? `https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/${activeAlbum.trackSlug}&color=%23ff5500&auto_play=${isPlaying}&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=false` : `https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/pubrecords/tracks&color=%23ff5500&auto_play=${isPlaying}&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=false`}
              style={{ display: 'block', border: 'none' }}
              title={`SoundCloud Player - ${activeAlbum.title}`}
            />
            <div
              style={{
                padding: '8px 16px',
                background: '#111827',
                borderTop: '1px solid #374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#9ca3af',
              }}
            >
              <span>✨ <strong>Sincronização Ativa:</strong> Todas as 63 faixas de soundcloud.com/pubrecords/tracks sincronizadas.</span>
              <span style={{ color: '#ff7733', fontWeight: 600 }}>100% Volume Analógico</span>
            </div>
          </div>

          {/* PRATELEIRA DE DISCOS DE VINIL */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📚 PRATELEIRA DE VINIS OFICIAIS • PUB RECORDS ({VINYL_ALBUMS.length} DISCOS)
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
                        width: '52px',
                        height: '52px',
                        borderRadius: '6px',
                        background: album.coverBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                        flexShrink: 0,
                      }}
                    >
                      {album.coverImage ? (
                        <img
                          src={album.coverImage}
                          alt={album.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span>🎵</span>
                      )}
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
