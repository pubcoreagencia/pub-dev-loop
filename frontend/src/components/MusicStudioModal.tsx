import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { studioSynthAudio, type DrumComponent } from '../utils/StudioSynthAudio';

export const MusicStudioModal: React.FC = () => {
  const activeModal = useStore((s) => s.activeStudioModal);
  const closeModal = () => useStore.getState().setActiveStudioModal(null);

  const keysList = [
    { note: 'C4', label: 'Dó', freq: 261.63, isBlack: false, keyShortcut: 'A' },
    { note: 'C#4', label: 'Dó#', freq: 277.18, isBlack: true, keyShortcut: 'W' },
    { note: 'D4', label: 'Ré', freq: 293.66, isBlack: false, keyShortcut: 'S' },
    { note: 'D#4', label: 'Ré#', freq: 311.13, isBlack: true, keyShortcut: 'E' },
    { note: 'E4', label: 'Mi', freq: 329.63, isBlack: false, keyShortcut: 'D' },
    { note: 'F4', label: 'Fá', freq: 349.23, isBlack: false, keyShortcut: 'F' },
    { note: 'F#4', label: 'Fá#', freq: 369.99, isBlack: true, keyShortcut: 'T' },
    { note: 'G4', label: 'Sol', freq: 392.00, isBlack: false, keyShortcut: 'G' },
    { note: 'G#4', label: 'Sol#', freq: 415.30, isBlack: true, keyShortcut: 'Y' },
    { note: 'A4', label: 'Lá', freq: 440.00, isBlack: false, keyShortcut: 'H' },
    { note: 'A#4', label: 'Lá#', freq: 466.16, isBlack: true, keyShortcut: 'U' },
    { note: 'B4', label: 'Si', freq: 493.88, isBlack: false, keyShortcut: 'J' },
    { note: 'C5', label: 'Dó 5', freq: 523.25, isBlack: false, keyShortcut: 'K' },
  ];

  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [waveType, setWaveType] = useState<OscillatorType>('sawtooth');

  const drumPieces: Array<{ id: DrumComponent; name: string; key: string; icon: string; color: string }> = [
    { id: 'kick', name: 'Bumbo (Kick)', key: '1', icon: '🥁', color: '#ef4444' },
    { id: 'snare', name: 'Caixa (Snare)', key: '2', icon: '🪘', color: '#f59e0b' },
    { id: 'hihat_closed', name: 'Chimbal Fechado', key: '3', icon: '🪙', color: '#38bdf8' },
    { id: 'hihat_open', name: 'Chimbal Aberto', key: '4', icon: '✨', color: '#0ea5e9' },
    { id: 'tom_high', name: 'Tom 1 (Alto)', key: '5', icon: '🎯', color: '#10b981' },
    { id: 'tom_low', name: 'Tom 2 (Médio)', key: '6', icon: '🎯', color: '#059669' },
    { id: 'floor_tom', name: 'Surdo (Floor Tom)', key: '7', icon: '🛢️', color: '#8b5cf6' },
    { id: 'crash', name: 'Prato Crash', key: '8', icon: '💥', color: '#eab308' },
    { id: 'ride', name: 'Prato Ride', key: '9', icon: '🛎️', color: '#facc15' },
  ];

  const [activeDrum, setActiveDrum] = useState<string | null>(null);
  const [isPlayingDaw, setIsPlayingDaw] = useState(false);
  const [bpm, setBpm] = useState(124);
  const [currentStep, setCurrentStep] = useState(0);

  const [grid, setGrid] = useState<Record<DrumComponent, boolean[]>>({
    kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hihat_closed: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    hihat_open: [false, false, false, false, false, false, true, false, false, false, false, false, false, false, true, false],
    tom_high: new Array(16).fill(false),
    tom_low: new Array(16).fill(false),
    floor_tom: new Array(16).fill(false),
    crash: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    ride: new Array(16).fill(false),
  });

  const toggleStep = (track: DrumComponent, index: number) => {
    setGrid((prev) => {
      const copy = [...prev[track]];
      copy[index] = !copy[index];
      return { ...prev, [track]: copy };
    });
  };

  useEffect(() => {
    if (!isPlayingDaw) return;
    const intervalMs = (60 / bpm / 4) * 1000;
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = (prev + 1) % 16;
        (Object.keys(grid) as DrumComponent[]).forEach((track) => {
          if (grid[track][next]) {
            studioSynthAudio.triggerDrum(track);
          }
        });
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlayingDaw, bpm, grid]);

  useEffect(() => {
    if (!activeModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      if (activeModal === 'keyboard') {
        const match = keysList.find((k) => k.keyShortcut.toUpperCase() === e.key.toUpperCase());
        if (match) {
          studioSynthAudio.playNote(match.freq, waveType);
          setActiveNote(match.note);
          setTimeout(() => setActiveNote(null), 180);
        }
      } else if (activeModal === 'drums') {
        const match = drumPieces.find((d) => d.key === e.key);
        if (match) {
          studioSynthAudio.triggerDrum(match.id);
          setActiveDrum(match.id);
          setTimeout(() => setActiveDrum(null), 180);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, waveType]);

  if (!activeModal || (activeModal as string) === 'daw') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 20000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={closeModal}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '20px',
          border: '1px solid #38bdf8',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(56, 189, 248, 0.25)',
          maxWidth: '920px',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(90deg, #1e293b, #0f172a)',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>
              {activeModal === 'keyboard' && '🎹'}
              {activeModal === 'drums' && '🥁'}
              {activeModal === 'daw' && '🎛️'}
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.05em' }}>
                {activeModal === 'keyboard' && 'SINTETIZADOR PUB REC • TECLADO REALISTA (DÓ A DÓ)'}
                {activeModal === 'drums' && 'BATERIA ACÚSTICA PUB RECORDS • FULL KIT'}
                {activeModal === 'daw' && 'MESA SSL 4000G • DAW SEQUENCER LIKE SUNO AI'}
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {activeModal === 'keyboard' && 'Oitava completa C4 a C5 com sustenidos • Web Audio API Analógico'}
                {activeModal === 'drums' && 'Bumbo, Caixa, Toms, Chimbal e Pratos com pads acionáveis'}
                {activeModal === 'daw' && 'Crie batidas, controle BPM e gere loops para produções da holding'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => useStore.getState().setActiveStudioModal('keyboard')}
              style={{
                background: activeModal === 'keyboard' ? '#0284c7' : '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🎹 Teclado
            </button>
            <button
              onClick={() => useStore.getState().setActiveStudioModal('drums')}
              style={{
                background: activeModal === 'drums' ? '#0284c7' : '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🥁 Bateria
            </button>
            <button
              onClick={() => useStore.getState().setActiveStudioModal('daw')}
              style={{
                background: activeModal === 'daw' ? '#0284c7' : '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🎛️ DAW SSL
            </button>
            <button
              onClick={closeModal}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                marginLeft: '8px',
              }}
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {activeModal === 'keyboard' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Toque com o mouse ou usando as teclas do teclado (A, W, S, E, D, F, T, G, Y, H, U, J, K):
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Timbre:</span>
                {(['sawtooth', 'sine', 'square', 'triangle'] as OscillatorType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setWaveType(type)}
                    style={{
                      background: waveType === type ? '#38bdf8' : '#334155',
                      color: waveType === type ? '#000' : '#cbd5e1',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                height: '240px',
                background: '#09090b',
                padding: '16px',
                borderRadius: '16px',
                boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.8)',
                border: '2px solid #334155',
                userSelect: 'none',
              }}
            >
              {keysList.filter((k) => !k.isBlack).map((whiteKey) => {
                const isPressed = activeNote === whiteKey.note;
                return (
                  <div
                    key={whiteKey.note}
                    onClick={() => {
                      studioSynthAudio.playNote(whiteKey.freq, waveType);
                      setActiveNote(whiteKey.note);
                      setTimeout(() => setActiveNote(null), 180);
                    }}
                    style={{
                      flex: 1,
                      height: '100%',
                      background: isPressed ? '#e2e8f0' : 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 85%, #cbd5e1 100%)',
                      borderRadius: '0 0 8px 8px',
                      margin: '0 2px',
                      boxShadow: isPressed ? 'inset 0 -2px 6px rgba(0,0,0,0.4)' : '0 4px 10px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      paddingBottom: '12px',
                      cursor: 'pointer',
                      transform: isPressed ? 'translateY(3px)' : 'none',
                      transition: 'transform 0.05s ease',
                    }}
                  >
                    <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '13px' }}>{whiteKey.label}</span>
                    <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 600 }}>[{whiteKey.keyShortcut}]</span>
                  </div>
                );
              })}

              {[
                { note: 'C#4', label: 'Dó#', freq: 277.18, left: '8.5%', keyShortcut: 'W' },
                { note: 'D#4', label: 'Ré#', freq: 311.13, left: '21.5%', keyShortcut: 'E' },
                { note: 'F#4', label: 'Fá#', freq: 369.99, left: '46.5%', keyShortcut: 'T' },
                { note: 'G#4', label: 'Sol#', freq: 415.30, left: '59.5%', keyShortcut: 'Y' },
                { note: 'A#4', label: 'Lá#', freq: 466.16, left: '72.5%', keyShortcut: 'U' },
              ].map((blackKey) => {
                const isPressed = activeNote === blackKey.note;
                return (
                  <div
                    key={blackKey.note}
                    onClick={() => {
                      studioSynthAudio.playNote(blackKey.freq, waveType);
                      setActiveNote(blackKey.note);
                      setTimeout(() => setActiveNote(null), 180);
                    }}
                    style={{
                      position: 'absolute',
                      left: blackKey.left,
                      width: '6.8%',
                      height: '60%',
                      background: isPressed ? '#27272a' : 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
                      borderRadius: '0 0 6px 6px',
                      zIndex: 2,
                      boxShadow: '0 6px 12px rgba(0,0,0,0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      paddingBottom: '8px',
                      cursor: 'pointer',
                      transform: isPressed ? 'translateY(2px)' : 'none',
                    }}
                  >
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '10px' }}>{blackKey.label}</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>[{blackKey.keyShortcut}]</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeModal === 'drums' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Toque nos tambores e pratos ou use as teclas numéricas de 1 a 9:
              </span>
              <button
                onClick={() => studioSynthAudio.playDrumPattern()}
                style={{
                  background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ▶ Tocar Beat Automático
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {drumPieces.map((piece) => {
                const isTriggered = activeDrum === piece.id;
                return (
                  <button
                    key={piece.id}
                    onClick={() => {
                      studioSynthAudio.triggerDrum(piece.id);
                      setActiveDrum(piece.id);
                      setTimeout(() => setActiveDrum(null), 180);
                    }}
                    style={{
                      background: isTriggered ? piece.color : 'rgba(30, 41, 59, 0.75)',
                      border: `2px solid ${isTriggered ? '#ffffff' : piece.color}`,
                      borderRadius: '14px',
                      padding: '24px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transform: isTriggered ? 'scale(0.96)' : 'scale(1)',
                      transition: 'all 0.08s ease',
                      boxShadow: isTriggered ? `0 0 25px ${piece.color}` : '0 6px 16px rgba(0,0,0,0.3)',
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>{piece.icon}</span>
                    <span style={{ color: isTriggered ? '#000' : '#f8fafc', fontWeight: 800, fontSize: '13px' }}>
                      {piece.name}
                    </span>
                    <span style={{ color: isTriggered ? '#000' : '#94a3b8', fontSize: '11px', fontWeight: 700 }}>
                      Tecla [{piece.key}]
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeModal === 'daw' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setIsPlayingDaw(!isPlayingDaw)}
                  style={{
                    background: isPlayingDaw ? '#ef4444' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{isPlayingDaw ? '⏸ Pausar' : '▶ Play Sequencer'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                  <span>BPM:</span>
                  <input
                    type="range"
                    min="70"
                    max="180"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    style={{ width: '80px', accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontWeight: 700, color: '#38bdf8' }}>{bpm}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setBpm(132);
                    setGrid({
                      kick: [true, false, false, false, false, false, true, false, false, false, true, false, false, false, false, false],
                      snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
                      hihat_closed: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
                      hihat_open: [false, false, false, false, false, false, true, false, false, false, false, false, false, false, true, false],
                      tom_high: new Array(16).fill(false),
                      tom_low: new Array(16).fill(false),
                      floor_tom: new Array(16).fill(false),
                      crash: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
                      ride: new Array(16).fill(false),
                    });
                  }}
                  style={{
                    background: '#334155',
                    color: '#f8fafc',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Preset Trap
                </button>
                <button
                  onClick={() => {
                    setBpm(126);
                    setGrid({
                      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
                      snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
                      hihat_closed: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
                      hihat_open: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
                      tom_high: new Array(16).fill(false),
                      tom_low: new Array(16).fill(false),
                      floor_tom: new Array(16).fill(false),
                      crash: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
                      ride: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
                    });
                  }}
                  style={{
                    background: '#334155',
                    color: '#f8fafc',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Preset 4x4 House
                </button>
              </div>
            </div>

            <div
              style={{
                background: '#0a0f1d',
                borderRadius: '14px',
                padding: '16px',
                border: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowX: 'auto',
              }}
            >
              {(['kick', 'snare', 'hihat_closed', 'hihat_open', 'crash'] as DrumComponent[]).map((track) => (
                <div key={track} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '110px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#38bdf8',
                      textTransform: 'uppercase',
                    }}
                  >
                    {track === 'hihat_closed' ? 'Hi-Hat (C)' : track === 'hihat_open' ? 'Hi-Hat (O)' : track}
                  </span>

                  <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                    {grid[track].map((isActive, stepIdx) => {
                      const isCurrent = isPlayingDaw && currentStep === stepIdx;
                      return (
                        <div
                          key={stepIdx}
                          onClick={() => toggleStep(track, stepIdx)}
                          style={{
                            flex: 1,
                            height: '34px',
                            background: isActive
                              ? '#0284c7'
                              : isCurrent
                              ? '#334155'
                              : stepIdx % 4 === 0
                              ? '#1e293b'
                              : '#0f172a',
                            border: isCurrent
                              ? '2px solid #38bdf8'
                              : isActive
                              ? '1px solid #38bdf8'
                              : '1px solid #1e293b',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            boxShadow: isActive ? '0 0 10px rgba(56, 189, 248, 0.4)' : 'none',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
