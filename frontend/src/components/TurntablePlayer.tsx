import React from 'react';
import { useStore } from '../store/useStore';
import { VINYL_ALBUMS } from './VinylJukeboxModal';

export const TurntablePlayer: React.FC = () => {
  const {
    isPlayingVinyl,
    activeAlbumId,
    vinylVolume,
    togglePlayVinyl,
    selectVinylAlbum,
    setVinylVolume,
    setJukeboxOpen,
  } = useStore();

  const currentAlbum = VINYL_ALBUMS.find((a) => a.id === activeAlbumId) || VINYL_ALBUMS[0];
  const currentTrackIndex = VINYL_ALBUMS.findIndex((a) => a.id === currentAlbum.id);

  const handleNext = () => {
    const nextIdx = (currentTrackIndex + 1) % VINYL_ALBUMS.length;
    selectVinylAlbum(VINYL_ALBUMS[nextIdx].id);
  };

  const handlePrev = () => {
    const prevIdx = (currentTrackIndex - 1 + VINYL_ALBUMS.length) % VINYL_ALBUMS.length;
    selectVinylAlbum(VINYL_ALBUMS[prevIdx].id);
  };

  return (
    <div
      className="turntable-hud-player"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #334155',
        borderRadius: '20px',
        padding: '4px 14px',
        fontSize: '11px',
        color: '#f8fafc',
      }}
    >
      <span
        onClick={() => setJukeboxOpen(true)}
        title="Abrir Jukebox de Vinil"
        style={{ fontSize: '14px', animation: isPlayingVinyl ? 'spin 4s linear infinite' : 'none', cursor: 'pointer' }}
      >
        📻
      </span>

      <div
        onClick={() => setJukeboxOpen(true)}
        style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
        title="Clique para escolher álbum"
      >
        <span style={{ fontWeight: 600, color: '#38bdf8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentAlbum.title}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '9px' }}>
          {currentAlbum.artist} • {currentAlbum.duration || currentAlbum.genre}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={handlePrev}
          title="Faixa Anterior"
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
        >
          ⏮
        </button>
        <button
          onClick={togglePlayVinyl}
          title={isPlayingVinyl ? 'Pausar' : 'Tocar'}
          style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '13px' }}
        >
          {isPlayingVinyl ? '⏸' : '▶'}
        </button>
        <button
          onClick={handleNext}
          title="Próxima Faixa"
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
        >
          ⏭
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: '#64748b' }}>🔊</span>
        <input
          type="range"
          min="0"
          max="100"
          value={vinylVolume}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setVinylVolume(v);
          }}
          style={{ width: '50px', height: '3px', accentColor: '#38bdf8', cursor: 'pointer' }}
        />
      </div>

      {/* SoundCloud Audio Stream para faixas da Pub Records */}
      {isPlayingVinyl && (
        <iframe
          width="1"
          height="1"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={currentAlbum.trackSlug ? `https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/${currentAlbum.trackSlug}&color=%23ff5500&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false` : "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/pubrecords/tracks&color=%23ff5500&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false"}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
          title="SoundCloud Stream"
        />
      )}
    </div>
  );
};
