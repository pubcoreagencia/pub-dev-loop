import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { VINYL_ALBUMS } from '../data/vinylTracks';

declare global {
  interface Window {
    SC?: {
      Widget: {
        (iframe: HTMLIFrameElement | string): any;
        Events: {
          READY: string;
          PLAY: string;
          PAUSE: string;
          FINISH: string;
          ERROR: string;
        };
      };
    };
  }
}

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

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);

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

  // Inicializa o SoundCloud Widget API no iframe e sincroniza volume
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const setupWidget = () => {
      try {
        if (window.SC?.Widget) {
          const widget = window.SC.Widget(iframe);
          widgetRef.current = widget;

          widget.bind(window.SC.Widget.Events.READY, () => {
            // Aplica o volume atual da vitrola (0 a 100)
            widget.setVolume(vinylVolume);
          });

          widget.bind(window.SC.Widget.Events.FINISH, () => {
            // Avança para a próxima faixa automaticamente
            handleNext();
          });

          // Define volume imediatamente caso já esteja pronto
          widget.setVolume(vinylVolume);
        }
      } catch (err) {
        console.warn('SoundCloud Widget setup warning:', err);
      }
    };

    // Tenta configurar logo ou aguarda o iframe carregar
    setupWidget();
    iframe.addEventListener('load', setupWidget);

    return () => {
      iframe.removeEventListener('load', setupWidget);
    };
  }, [activeAlbumId, isPlayingVinyl]);

  // Sincroniza o volume do som do SoundCloud em tempo real quando o slider é alterado
  useEffect(() => {
    // 1. Via SoundCloud Widget API
    if (widgetRef.current) {
      try {
        widgetRef.current.setVolume(vinylVolume);
      } catch {}
    }

    // 2. Via postMessage direto para o iframe (redundância cross-origin imediata)
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ method: 'setVolume', value: vinylVolume }),
          '*'
        );
      } catch {}
    }
  }, [vinylVolume]);

  const soundcloudSrc = currentAlbum.trackSlug
    ? `https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/${currentAlbum.trackSlug}&color=%23ff5500&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`
    : 'https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/pubrecords/tracks&color=%23ff5500&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false';

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
        <span style={{ fontSize: '9px', color: '#64748b', minWidth: '22px' }}>{vinylVolume}%</span>
      </div>

      {/* SoundCloud Audio Stream Oficial da Pub Records com controle de volume pelo Widget API */}
      {isPlayingVinyl && (
        <iframe
          ref={iframeRef}
          width="1"
          height="1"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={soundcloudSrc}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
          title="SoundCloud Stream"
        />
      )}
    </div>
  );
};
