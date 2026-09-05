import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export const PlayableArcadeModal: React.FC = () => {
  const activeGame = useStore((s) => s.activeArcadeGame);
  const closeArcade = useStore((s) => s.closeArcadeGame);
  const leaderboard = useStore((s) => s.arcadeLeaderboard);
  const recordScore = useStore((s) => s.recordArcadeScore);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [playerName, setPlayerName] = useState('Matheus Paes (CEO)');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sound synthesizer for arcade audio
  const playArcadeSound = (type: 'coin' | 'jump' | 'hit' | 'boost' | 'ko') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'jump' || type === 'boost') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'hit' || type === 'ko') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
    } catch {}
  };

  // Game Loop logic per arcade game
  useEffect(() => {
    if (!activeGame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localScore = 0;
    let localGameOver = false;
    let frameCount = 0;

    // Game Specific States
    let playerX = 200;
    let playerY = 180;
    let playerSpeed = 4;
    let obstacles: Array<{ x: number; y: number; width: number; height: number; speed: number; color: string }> = [];
    let enemies: Array<{ x: number; y: number; hp: number; type: string }> = [];
    let bullets: Array<{ x: number; y: number; vx: number; vy: number }> = [];

    const keys: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      if (e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        if (activeGame === 'metal-slug' || activeGame === 'cadillacs') {
          bullets.push({ x: playerX + 25, y: playerY + 12, vx: 10, vy: 0 });
          playArcadeSound('boost');
        } else if (activeGame === 'street-fighter') {
          playArcadeSound('hit');
          localScore += 250;
          setScore(localScore);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    playArcadeSound('coin');
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);

    const loop = () => {
      frameCount++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!localGameOver) {
        // ==========================================
        // 1. F1 GRAND PRIX ARCADE
        // ==========================================
        if (activeGame === 'f1') {
          // Track road background
          ctx.fillStyle = '#065f46';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          // Road
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(80, 0, 320, canvas.height);
          // Curbs
          const curbOffset = (frameCount * 8) % 40;
          for (let y = -40 + curbOffset; y < canvas.height; y += 40) {
            ctx.fillStyle = (Math.floor((y - curbOffset) / 40) % 2 === 0) ? '#ef4444' : '#ffffff';
            ctx.fillRect(72, y, 8, 20);
            ctx.fillRect(400, y, 8, 20);
            // Road dashes
            ctx.fillStyle = '#facc15';
            ctx.fillRect(238, y, 4, 25);
          }

          // Player controls
          if (keys['ArrowLeft'] || keys['a'] || keys['A']) playerX = Math.max(90, playerX - playerSpeed);
          if (keys['ArrowRight'] || keys['d'] || keys['D']) playerX = Math.min(380, playerX + playerSpeed);

          // Player F1 Car (Red Ferrari style)
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(playerX - 12, canvas.height - 70, 24, 45); // Body
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(playerX - 16, canvas.height - 65, 8, 14); // Front left tire
          ctx.fillRect(playerX + 8, canvas.height - 65, 8, 14);  // Front right tire
          ctx.fillRect(playerX - 18, canvas.height - 40, 9, 16); // Rear left tire
          ctx.fillRect(playerX + 9, canvas.height - 40, 9, 16);  // Rear right tire
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(playerX - 6, canvas.height - 50, 12, 12); // Cockpit helmet

          // Spawn rival cars
          if (frameCount % 45 === 0) {
            obstacles.push({
              x: 100 + Math.random() * 260,
              y: -50,
              width: 24,
              height: 42,
              speed: 4 + Math.random() * 3,
              color: ['#3b82f6', '#eab308', '#8b5cf6', '#06b6d4'][Math.floor(Math.random() * 4)],
            });
          }

          // Update rival cars
          for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.y += obs.speed;
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x - 12, obs.y, obs.width, obs.height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(obs.x - 15, obs.y + 4, 6, 12);
            ctx.fillRect(obs.x + 9, obs.y + 4, 6, 12);

            // Collision detection
            if (
              Math.abs(playerX - obs.x) < 22 &&
              Math.abs((canvas.height - 50) - obs.y) < 36
            ) {
              localGameOver = true;
              setGameOver(true);
              playArcadeSound('ko');
              recordScore(activeGame, playerName, localScore);
            }

            // Off screen
            if (obs.y > canvas.height + 50) {
              obstacles.splice(i, 1);
              localScore += 150;
              setScore(localScore);
            }
          }
        }

        // ==========================================
        // 2. METAL SLUG RETRO ASSAULT
        // ==========================================
        else if (activeGame === 'metal-slug') {
          // Desert war background
          ctx.fillStyle = '#78350f';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#b45309';
          ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

          // Controls
          if (keys['ArrowLeft'] || keys['a'] || keys['A']) playerX = Math.max(20, playerX - 4);
          if (keys['ArrowRight'] || keys['d'] || keys['D']) playerX = Math.min(canvas.width - 40, playerX + 4);

          // Marco Rossi character (Retro pixel hero)
          ctx.fillStyle = '#f8fafc'; // Shirt
          ctx.fillRect(playerX, canvas.height - 85, 20, 22);
          ctx.fillStyle = '#ef4444'; // Red vest
          ctx.fillRect(playerX - 2, canvas.height - 82, 6, 18);
          ctx.fillStyle = '#166534'; // Green pants
          ctx.fillRect(playerX + 2, canvas.height - 63, 16, 16);
          ctx.fillStyle = '#fef08a'; // Hair
          ctx.fillRect(playerX + 4, canvas.height - 98, 14, 12);

          // Spawn enemies
          if (frameCount % 60 === 0) {
            enemies.push({ x: canvas.width + 20, y: canvas.height - 85, hp: 2, type: 'soldier' });
          }

          // Bullets
          ctx.fillStyle = '#facc15';
          for (let b = bullets.length - 1; b >= 0; b--) {
            bullets[b].x += bullets[b].vx;
            ctx.fillRect(bullets[b].x, bullets[b].y, 10, 4);

            // Hit enemy
            for (let e = enemies.length - 1; e >= 0; e--) {
              if (Math.abs(bullets[b].x - enemies[e].x) < 20 && Math.abs(bullets[b].y - enemies[e].y) < 25) {
                enemies[e].hp--;
                bullets.splice(b, 1);
                playArcadeSound('hit');
                if (enemies[e].hp <= 0) {
                  enemies.splice(e, 1);
                  localScore += 500;
                  setScore(localScore);
                }
                break;
              }
            }
            if (bullets[b] && bullets[b].x > canvas.width) bullets.splice(b, 1);
          }

          // Enemies update
          ctx.fillStyle = '#374151';
          for (let e = enemies.length - 1; e >= 0; e--) {
            enemies[e].x -= 2;
            ctx.fillRect(enemies[e].x, enemies[e].y, 18, 24);
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(enemies[e].x + 2, enemies[e].y - 8, 14, 8); // Helmet
            ctx.fillStyle = '#374151';

            if (Math.abs(playerX - enemies[e].x) < 16) {
              localGameOver = true;
              setGameOver(true);
              playArcadeSound('ko');
              recordScore(activeGame, playerName, localScore);
            }
          }
        }

        // ==========================================
        // 3. STREET FIGHTER RETRO DUEL
        // ==========================================
        else if (activeGame === 'street-fighter') {
          // Dojo background
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

          // Ryu Player
          ctx.fillStyle = '#f8fafc'; // White Gi
          ctx.fillRect(120, canvas.height - 120, 36, 60);
          ctx.fillStyle = '#dc2626'; // Red Headband
          ctx.fillRect(126, canvas.height - 135, 24, 10);
          ctx.fillStyle = '#1e293b'; // Black belt
          ctx.fillRect(118, canvas.height - 85, 40, 8);

          // Opponent (Ken)
          const oppX = 320 + Math.sin(frameCount * 0.08) * 20;
          ctx.fillStyle = '#dc2626'; // Red Gi
          ctx.fillRect(oppX, canvas.height - 120, 36, 60);
          ctx.fillStyle = '#fde047'; // Blonde Hair
          ctx.fillRect(oppX + 4, canvas.height - 138, 28, 14);

          // HP Bars
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(40, 20, 160, 16);
          const oppHp = Math.max(0, 160 - Math.floor(localScore / 50));
          ctx.fillStyle = oppHp > 40 ? '#22c55e' : '#ef4444';
          ctx.fillRect(280, 20, oppHp, 16);

          if (oppHp <= 0) {
            localGameOver = true;
            setGameOver(true);
            playArcadeSound('coin');
            recordScore(activeGame, playerName, localScore + 10000);
          }
        }

        // ==========================================
        // 4. CADILLACS E DINOSSAUROS
        // ==========================================
        else {
          // Post-apocalyptic jungle
          ctx.fillStyle = '#14532d';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#3f6212';
          ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

          // Player Jack Tenrec
          if (keys['ArrowLeft'] || keys['a']) playerX = Math.max(30, playerX - 3.5);
          if (keys['ArrowRight'] || keys['d']) playerX = Math.min(canvas.width - 50, playerX + 3.5);

          ctx.fillStyle = '#f8fafc'; // White shirt
          ctx.fillRect(playerX, canvas.height - 110, 26, 32);
          ctx.fillStyle = '#1e3a8a'; // Blue jeans
          ctx.fillRect(playerX + 2, canvas.height - 80, 22, 26);

          // Dinosaur / Enemy Raptor
          const dinoX = canvas.width - ((frameCount * 3) % (canvas.width + 60));
          ctx.fillStyle = '#15803d'; // Green dinosaur
          ctx.fillRect(dinoX, canvas.height - 95, 45, 30);
          ctx.fillStyle = '#facc15'; // Dino eye
          ctx.fillRect(dinoX + 4, canvas.height - 90, 6, 6);

          // Bullets
          for (let b = bullets.length - 1; b >= 0; b--) {
            bullets[b].x += 8;
            ctx.fillStyle = '#f97316';
            ctx.fillRect(bullets[b].x, bullets[b].y, 12, 5);

            if (Math.abs(bullets[b].x - dinoX) < 30) {
              bullets.splice(b, 1);
              playArcadeSound('hit');
              localScore += 450;
              setScore(localScore);
            }
          }

          if (Math.abs(playerX - dinoX) < 22) {
            localGameOver = true;
            setGameOver(true);
            playArcadeSound('ko');
            recordScore(activeGame, playerName, localScore);
          }
        }

        // HUD overlay in canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, 36);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`SCORE: ${localScore.toLocaleString()}`, 15, 24);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`PLAYER: ${playerName.toUpperCase()}`, canvas.width - 240, 24);
      } else {
        // Game Over overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '16px monospace';
        ctx.fillText(`SCORE FINAL: ${localScore.toLocaleString()}`, canvas.width / 2, canvas.height / 2 + 15);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '12px monospace';
        ctx.fillText('CLIQUE EM "JOGAR NOVAMENTE" OU ESCOLHA OUTRO ARCADE', canvas.width / 2, canvas.height / 2 + 45);
        ctx.textAlign = 'left';
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeGame, playerName]);

  if (!activeGame) return null;

  const gameTitles: Record<string, string> = {
    f1: '🏎️ F1 GRAND PRIX RETRO ARCADE',
    'metal-slug': '🎖️ METAL SLUG RETRO ASSAULT',
    'street-fighter': '🥊 STREET FIGHTER II RETRO DUEL',
    cadillacs: '🦖 CADILLACS E DINOSSAUROS BRAWL',
  };

  const currentLeaderboard = leaderboard[activeGame] || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          background: '#090d16',
          border: '2px solid #38bdf8',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(56, 189, 248, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'popIn 0.2s ease-out',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(to right, #0f172a, #1e1b4b)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🕹️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.04em' }}>
                  {gameTitles[activeGame]}
                </h3>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: isPlaying ? '#0284c7' : gameOver ? '#dc2626' : '#10b981', color: '#fff' }}>
                  {isPlaying ? `PONTOS: ${score}` : gameOver ? 'GAME OVER' : 'PRONTO'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                PUB REC FLIPERAMA RETRO ARCADE • 100% JOGÁVEL
              </p>
            </div>
          </div>
          <button
            onClick={closeArcade}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#f8fafc',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px',
            }}
          >
            ✕ FECHAR
          </button>
        </div>

        {/* Content Body: Canvas + Leaderboard */}
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '16px', gap: '16px' }}>
          {/* Canvas Box */}
          <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                borderRadius: '12px',
                overflow: 'hidden',
                border: '3px solid #1e293b',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 0 25px rgba(56, 189, 248, 0.2)',
                background: '#000',
              }}
            >
              <canvas ref={canvasRef} width={480} height={320} style={{ display: 'block' }} />
            </div>

            {/* Controls Helper */}
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                gap: '12px',
                fontSize: '11px',
                color: '#94a3b8',
                fontFamily: 'monospace',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #1e293b',
              }}
            >
              <span>⌨️ <strong>WASD / Setas</strong>: Mover</span>
              <span>•</span>
              <span><strong>ESPAÇO / Z</strong>: Ação / Tiro / Golpe</span>
            </div>
          </div>

          {/* Leaderboard Panel */}
          <div
            style={{
              flex: '1 1 280px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#facc15', textTransform: 'uppercase' }}>
                  🏆 RANKING & HIGHSCORES
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                  PUB REC HALL
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentLeaderboard.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: idx === 0 ? 'rgba(250, 204, 21, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: idx === 0 ? '1px solid rgba(250, 204, 21, 0.4)' : '1px solid transparent',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: idx === 0 ? '#facc15' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#b45309' : '#64748b' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{item.name}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                      {item.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Change Player Name / Replay */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #334155', paddingTop: '12px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Nome do Jogador / Agente:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={{
                  width: '100%',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '11px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
