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
    isVinylShuffle,
    isRadioMode,
    togglePlayVinyl,
    setVinylVolume,
    setJukeboxOpen,
    setVinylShuffle,
    toggleRadioMode,
    playNextVinylTrack,
    playPrevVinylTrack,
  } = useStore();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);

  const currentAlbum = VINYL_ALBUMS.find((a) => a.id === activeAlbumId) || VINYL_ALBUMS[0];

  // Listener global de postMessage do SoundCloud para avançar faixa automaticamente no fim
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (
          data &&
          (data.method === 'finish' ||
            data.event === 'finish' ||
            data.event === 'onFinish' ||
            (data.widgetId && data.method === 'finish'))
        ) {
          console.log('[TurntablePlayer] SoundCloud track finish detected via postMessage, advancing track!');
          playNextVinylTrack();
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [playNextVinylTrack]);

  // Watchdog ativo: detecta fim da música por polling de posição para garantir avanço contínuo
  useEffect(() => {
    if (!isPlayingVinyl) return;

    let hasTriggered = false;
    const interval = setInterval(() => {
      if (widgetRef.current && !hasTriggered) {
        try {
          widgetRef.current.getPosition((pos: number) => {
            widgetRef.current.getDuration((dur: number) => {
              if (dur > 0 && pos > 0 && dur - pos <= 1800) {
                console.log('[TurntablePlayer Watchdog] Fim da música alcançado, avançando automaticamente!');
                hasTriggered = true;
                playNextVinylTrack();
              }
            });
          });
        } catch {}
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlayingVinyl, activeAlbumId, playNextVinylTrack]);

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
            widget.setVolume(vinylVolume);
          });

          widget.bind(window.SC.Widget.Events.FINISH, () => {
            console.log('[TurntablePlayer] SoundCloud FINISH event triggered!');
            playNextVinylTrack();
          });

          widget.setVolume(vinylVolume);
        }
      } catch (err) {
        console.warn('SoundCloud Widget setup warning:', err);
      }
    };

    setupWidget();
    iframe.addEventListener('load', setupWidget);

    return () => {
      iframe.removeEventListener('load', setupWidget);
    };
  }, [activeAlbumId, isPlayingVinyl, playNextVinylTrack]);

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <button
          onClick={playPrevVinylTrack}
          title="Faixa Anterior"
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px', padding: '2px' }}
        >
          ⏮
        </button>
        <button
          onClick={togglePlayVinyl}
          title={isPlayingVinyl ? 'Pausar' : 'Tocar'}
          style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
        >
          {isPlayingVinyl ? '⏸' : '▶'}
        </button>
        <button
          onClick={playNextVinylTrack}
          title="Próxima Faixa"
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px', padding: '2px' }}
        >
          ⏭
        </button>
        <button
          onClick={() => setVinylShuffle(!isVinylShuffle)}
          title={isVinylShuffle ? 'Modo Aleatório Ativado (Clique para desativar)' : 'Ativar Modo Aleatório (Shuffle)'}
          style={{
            background: isVinylShuffle ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            border: isVinylShuffle ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
            borderRadius: '4px',
            color: isVinylShuffle ? '#38bdf8' : '#64748b',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '1px 4px',
            transition: 'all 0.2s ease',
          }}
        >
          🔀
        </button>
        <button
          onClick={toggleRadioMode}
          title={isRadioMode ? 'Rádio PUB Records Ativa (Clique para desativar)' : 'Ativar Modo Rádio 24h com o CEO Matheus Paes'}
          style={{
            background: isRadioMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            border: isRadioMode ? '1.5px solid #ef4444' : '1px solid #475569',
            borderRadius: '6px',
            color: isRadioMode ? '#f87171' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '2px 7px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            boxShadow: isRadioMode ? '0 0 12px rgba(239, 68, 68, 0.5)' : 'none',
          }}
        >
          <span>📻</span>
          <span>RÁDIO</span>
          {isRadioMode && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px #ef4444',
              }}
            />
          )}
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

      {/* SoundCloud Audio Stream Oficial da Pub Records - Unthrottled offscreen iframe */}
      {isPlayingVinyl && (
        <iframe
          ref={iframeRef}
          width="300"
          height="80"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={soundcloudSrc}
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '-9999px',
            width: '300px',
            height: '80px',
            opacity: 0.01,
            pointerEvents: 'none',
            zIndex: -1,
          }}
          title="SoundCloud Stream"
        />
      )}
    </div>
  );
};
