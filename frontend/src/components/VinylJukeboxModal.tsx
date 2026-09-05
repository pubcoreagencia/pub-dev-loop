import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { type VinylAlbum, PUB_ARTWORK, VINYL_ALBUMS } from '../data/vinylTracks';
import { useStore } from '../store/useStore';

export type { VinylAlbum };
export { PUB_ARTWORK, VINYL_ALBUMS };

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
  const isVinylShuffle = useStore((s) => s.isVinylShuffle);
  const setVinylShuffle = useStore((s) => s.setVinylShuffle);
  const isRadioMode = useStore((s) => s.isRadioMode);
  const toggleRadioMode = useStore((s) => s.toggleRadioMode);
  const selectVinylAlbumStore = useStore((s) => s.selectVinylAlbum);
  const [searchTerm, setSearchTerm] = useState('');

  const activeAlbum = VINYL_ALBUMS.find((a) => a.id === selectedAlbumId) || VINYL_ALBUMS[0];

  const filteredAlbums = useMemo(() => {
    if (!searchTerm.trim()) return VINYL_ALBUMS;
    const term = searchTerm.toLowerCase().trim();
    return VINYL_ALBUMS.filter(
      (a) =>
        a.title.toLowerCase().includes(term) ||
        a.genre.toLowerCase().includes(term) ||
        a.artist.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 20000000,
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggleRadioMode}
              style={{
                background: isRadioMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(30, 41, 59, 0.8)',
                border: `1.5px solid ${isRadioMode ? '#ef4444' : '#475569'}`,
                color: isRadioMode ? '#f87171' : '#cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: isRadioMode ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none',
              }}
              title={isRadioMode ? 'Rádio PUB Records Ativa (Clique para desativar)' : 'Ativar Modo Rádio 24h com locução do CEO'}
            >
              <span>📻</span>
              <span>{isRadioMode ? 'Rádio PUB: AO VIVO 🔴' : 'Modo Rádio 24h'}</span>
            </button>

            <button
              onClick={() => setVinylShuffle(!isVinylShuffle)}
              style={{
                background: isVinylShuffle ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                border: `1.5px solid ${isVinylShuffle ? '#38bdf8' : '#475569'}`,
                color: isVinylShuffle ? '#38bdf8' : '#cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              title={isVinylShuffle ? 'Modo Aleatório Ativado' : 'Tocar faixas em modo aleatório'}
            >
              <span>🔀</span>
              <span>{isVinylShuffle ? 'Aleatório: Ativo' : 'Modo Aleatório'}</span>
            </button>

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
                {isVinylShuffle && (
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#38bdf8', color: '#000', fontWeight: 700 }}>
                    🔀 SHUFFLE ATIVO
                  </span>
                )}
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
              src={activeAlbum.trackSlug ? `https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/${activeAlbum.trackSlug}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=false` : `https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/pubrecords/tracks&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=false`}
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
              <span>✨ <strong>Catálogo Oficial:</strong> Todas as 63 faixas de soundcloud.com/pubrecords sincronizadas.</span>
              <span style={{ color: '#ff7733', fontWeight: 600 }}>Controle de Volume no HUD</span>
            </div>
          </div>

          {/* PRATELEIRA DE DISCOS DE VINIL */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📚 PRATELEIRA DE VINIS • PUB RECORDS ({filteredAlbums.length} {filteredAlbums.length === 1 ? 'DISCO' : 'DISCOS'})
              </h4>
              <input
                type="text"
                placeholder="🔍 Filtrar faixas por nome, gênero..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  color: '#f8fafc',
                  fontSize: '11px',
                  outline: 'none',
                  width: '240px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {filteredAlbums.map((album) => {
                const isSelected = album.id === selectedAlbumId;
                return (
                  <div
                    key={album.id}
                    onClick={() => {
                      if (album.id === 'album-pubrecords-shuffle') {
                        selectVinylAlbumStore('album-pubrecords-shuffle');
                      } else {
                        onSelectAlbum(album);
                      }
                    }}
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
    </div>,
    document.body
  );
};
