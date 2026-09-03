import React from 'react';
import { useStore } from '../store/useStore';

interface Track {
  id: string;
  albumId: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
}

const PLAYLIST: Track[] = [
  { id: 't1', albumId: 'album-synth', title: 'Midnight Compile Session', artist: 'Neon Workforce', genre: 'Synthwave / Lo-Fi', duration: '3:45' },
  { id: 't2', albumId: 'album-bossa', title: 'Bossa Nova for Code Reviewers', artist: 'Arthur Vance Trio', genre: 'Bossa Jazz', duration: '4:12' },
  { id: 't3', albumId: 'album-idm', title: 'Zero Any in TypeScript', artist: 'Helena & The Solid State', genre: 'IDM Minimal', duration: '5:01' },
  { id: 't4', albumId: 'album-rock', title: 'Friday 17:59 Production Deploy', artist: 'Crash Silveira Band', genre: 'Speed Synth', duration: '2:58' },
  { id: 't5', albumId: 'album-8bit', title: 'Duck in the Database', artist: 'Chaos Monkey & Tiago', genre: 'Chiptune 8-bit', duration: '3:20' },
  { id: 't6', albumId: 'album-lofi', title: 'Matcha & Memory Leaks', artist: 'Sentinel Beatriz', genre: 'Dark Lo-Fi Chill', duration: '4:30' },
];

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

  const currentTrack = PLAYLIST.find((t) => t.albumId === activeAlbumId) || PLAYLIST[0];
  const currentTrackIndex = PLAYLIST.findIndex((t) => t.albumId === currentTrack.albumId);

  const handleNext = () => {
    const nextIdx = (currentTrackIndex + 1) % PLAYLIST.length;
    selectVinylAlbum(PLAYLIST[nextIdx].albumId);
  };

  const handlePrev = () => {
    const prevIdx = (currentTrackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    selectVinylAlbum(PLAYLIST[prevIdx].albumId);
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
          {currentTrack.title}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '9px' }}>
          {currentTrack.artist} • {currentTrack.genre}
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
    </div>
  );
};
