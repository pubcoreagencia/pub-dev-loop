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
  const [victory, setVictory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerName, setPlayerName] = useState('Matheus Paes (CEO)');

  const modalRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Toggle HTML5 Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Web Audio Synthesizer for Retro Arcade Sound Effects
  const playArcadeSound = (type: 'coin' | 'jump' | 'hit' | 'boost' | 'ko' | 'shot' | 'hadouken') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'coin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'jump') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'shot') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'hadouken') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'ko') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'boost') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch {}
  };

  // Game Loop
  useEffect(() => {
    if (!activeGame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localScore = 0;
    let localGameOver = false;
    let localVictory = false;
    let frameCount = 0;

    // Common player state
    let playerX = 80;
    let playerY = canvas.height - 85;
    let playerVy = 0;
    let isJumping = false;
    let isCrouching = false;
    let playerHp = 100;

    // Combat state for Street Fighter & Cadillacs
    let punchTimer = 0;
    let kickTimer = 0;
    let hadoukenCooldown = 0;
    let opponentHp = 100;
    let opponentX = canvas.width - 120;
    let opponentY = canvas.height - 85;
    let opponentState: 'idle' | 'walk' | 'punch' | 'kick' | 'hurt' | 'special' = 'idle';
    let opponentTimer = 0;

    // Projectiles & Particles
    let bullets: Array<{ x: number; y: number; vx: number; vy: number; color?: string; radius?: number; isEnemy?: boolean }> = [];
    let enemies: Array<{ x: number; y: number; hp: number; maxHp: number; type: string; vx: number; shootCooldown: number }> = [];
    let particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }> = [];
    let obstacles: Array<{ x: number; y: number; width: number; height: number; speed: number; color: string }> = [];

    const keys: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      keys[e.code] = true;

      // Street Fighter Controls
      if (activeGame === 'street-fighter') {
        if ((e.code === 'KeyJ' || e.key === 'j' || e.key === 'J') && punchTimer <= 0) {
          punchTimer = 12;
          playArcadeSound('hit');
          // Hit check Ryu punch on Ken
          if (Math.abs(opponentX - playerX) < 70 && !isCrouching) {
            opponentHp = Math.max(0, opponentHp - 12);
            localScore += 300;
            setScore(localScore);
            opponentState = 'hurt';
            opponentTimer = 10;
            for (let i = 0; i < 6; i++) {
              particles.push({
                x: opponentX + 10,
                y: opponentY - 30,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 12,
                maxLife: 12,
                color: '#facc15',
                size: 3,
              });
            }
          }
        } else if ((e.code === 'KeyK' || e.key === 'k' || e.key === 'K') && kickTimer <= 0) {
          kickTimer = 15;
          playArcadeSound('hit');
          if (Math.abs(opponentX - playerX) < 80) {
            opponentHp = Math.max(0, opponentHp - 18);
            localScore += 450;
            setScore(localScore);
            opponentState = 'hurt';
            opponentTimer = 12;
            for (let i = 0; i < 8; i++) {
              particles.push({
                x: opponentX + 10,
                y: opponentY - 20,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 14,
                maxLife: 14,
                color: '#ef4444',
                size: 4,
              });
            }
          }
        } else if ((e.code === 'KeyL' || e.key === 'l' || e.key === 'L' || e.key === ' ') && hadoukenCooldown <= 0) {
          hadoukenCooldown = 40;
          playArcadeSound('hadouken');
          bullets.push({
            x: playerX + 35,
            y: playerY - 30,
            vx: 8,
            vy: 0,
            color: '#38bdf8',
            radius: 12,
          });
        }
      }

      // Metal Slug & Cadillacs Shooting
      if (activeGame === 'metal-slug' || activeGame === 'cadillacs') {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'z' || e.key === 'Z' || e.key === 'j' || e.key === 'J') {
          playArcadeSound('shot');
          bullets.push({
            x: playerX + 28,
            y: playerY - 18,
            vx: 12,
            vy: 0,
            color: '#facc15',
            radius: 4,
          });
          if (activeGame === 'cadillacs' && (e.key === 'j' || e.key === 'J')) {
            punchTimer = 10;
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
      keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    playArcadeSound('coin');
    setIsPlaying(true);
    setGameOver(false);
    setVictory(false);
    setScore(0);

    const loop = () => {
      frameCount++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!localGameOver) {
        // =========================================================
        // 1. F1 GRAND PRIX ARCADE
        // =========================================================
        if (activeGame === 'f1') {
          ctx.fillStyle = '#065f46';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(70, 0, 340, canvas.height);

          const curbOffset = (frameCount * 10) % 40;
          for (let y = -40 + curbOffset; y < canvas.height; y += 40) {
            ctx.fillStyle = Math.floor((y - curbOffset) / 40) % 2 === 0 ? '#ef4444' : '#ffffff';
            ctx.fillRect(62, y, 8, 20);
            ctx.fillRect(410, y, 8, 20);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(238, y, 4, 25);
          }

          if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) playerX = Math.max(80, playerX - 5);
          if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) playerX = Math.min(380, playerX + 5);

          ctx.fillStyle = '#dc2626';
          ctx.fillRect(playerX - 12, canvas.height - 70, 24, 45);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(playerX - 16, canvas.height - 65, 8, 14);
          ctx.fillRect(playerX + 8, canvas.height - 65, 8, 14);
          ctx.fillRect(playerX - 18, canvas.height - 40, 9, 16);
          ctx.fillRect(playerX + 9, canvas.height - 40, 9, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('01', playerX - 6, canvas.height - 42);

          if (frameCount % 45 === 0) {
            const rivalX = 90 + Math.random() * 280;
            const colors = ['#2563eb', '#16a34a', '#ca8a04', '#9333ea'];
            obstacles.push({
              x: rivalX,
              y: -50,
              width: 24,
              height: 42,
              speed: 4 + Math.random() * 3,
              color: colors[Math.floor(Math.random() * colors.length)],
            });
          }

          for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            o.y += o.speed;
            ctx.fillStyle = o.color;
            ctx.fillRect(o.x - 12, o.y, o.width, o.height);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(o.x - 16, o.y + 5, 6, 12);
            ctx.fillRect(o.x + 10, o.y + 5, 6, 12);
            ctx.fillRect(o.x - 17, o.y + 24, 7, 14);
            ctx.fillRect(o.x + 10, o.y + 24, 7, 14);

            if (
              Math.abs(playerX - o.x) < 22 &&
              canvas.height - 50 > o.y &&
              canvas.height - 70 < o.y + o.height
            ) {
              localGameOver = true;
              setGameOver(true);
              playArcadeSound('ko');
              recordScore(activeGame, playerName, localScore);
            }

            if (o.y > canvas.height) {
              obstacles.splice(i, 1);
              localScore += 200;
              setScore(localScore);
            }
          }
        }

        // =========================================================
        // 2. METAL SLUG RETRO ASSAULT (100% WORKING BULLETS & HITBOX)
        // =========================================================
        else if (activeGame === 'metal-slug') {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#b45309';
          ctx.fillRect(0, canvas.height - 45, canvas.width, 45);
          ctx.fillStyle = '#d97706';
          ctx.fillRect(0, canvas.height - 42, canvas.width, 4);

          if ((keys['ArrowUp'] || keys['KeyW'] || keys['w']) && !isJumping) {
            playerVy = -9;
            isJumping = true;
            playArcadeSound('jump');
          }
          playerY += playerVy;
          if (playerY < canvas.height - 85) {
            playerVy += 0.5;
          } else {
            playerY = canvas.height - 85;
            playerVy = 0;
            isJumping = false;
          }

          if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) playerX = Math.max(20, playerX - 4);
          if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) playerX = Math.min(canvas.width - 50, playerX + 4);

          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(playerX, playerY, 20, 24);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(playerX - 2, playerY + 2, 6, 20);
          ctx.fillStyle = '#166534';
          ctx.fillRect(playerX + 2, playerY + 24, 16, 16);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(playerX + 4, playerY - 14, 14, 14);
          ctx.fillStyle = '#334155';
          ctx.fillRect(playerX + 18, playerY + 8, 12, 6);

          if (frameCount % 75 === 0) {
            enemies.push({
              x: canvas.width + 20,
              y: canvas.height - 85,
              hp: 2,
              maxHp: 2,
              type: 'soldier',
              vx: 1.8,
              shootCooldown: 60,
            });
          }

          for (let b = bullets.length - 1; b >= 0; b--) {
            const bullet = bullets[b];
            bullet.x += bullet.vx;
            ctx.fillStyle = bullet.color || '#facc15';
            ctx.fillRect(bullet.x, bullet.y, 10, 4);

            for (let e = enemies.length - 1; e >= 0; e--) {
              const enemy = enemies[e];
              if (
                bullet.x > enemy.x &&
                bullet.x < enemy.x + 24 &&
                bullet.y > enemy.y - 15 &&
                bullet.y < enemy.y + 40
              ) {
                enemy.hp--;
                bullets.splice(b, 1);
                playArcadeSound('hit');

                for (let p = 0; p < 6; p++) {
                  particles.push({
                    x: enemy.x + 10,
                    y: enemy.y + 10,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5,
                    life: 10,
                    maxLife: 10,
                    color: '#f97316',
                    size: 3,
                  });
                }

                if (enemy.hp <= 0) {
                  for (let p = 0; p < 14; p++) {
                    particles.push({
                      x: enemy.x + 10,
                      y: enemy.y + 10,
                      vx: (Math.random() - 0.5) * 8,
                      vy: (Math.random() - 0.5) * 8,
                      life: 18,
                      maxLife: 18,
                      color: Math.random() > 0.5 ? '#ef4444' : '#facc15',
                      size: 5,
                    });
                  }
                  enemies.splice(e, 1);
                  localScore += 500;
                  setScore(localScore);
                }
                break;
              }
            }

            if (bullets[b] && bullets[b].x > canvas.width) {
              bullets.splice(b, 1);
            }
          }

          for (let e = enemies.length - 1; e >= 0; e--) {
            const enemy = enemies[e];
            enemy.x -= enemy.vx;

            ctx.fillStyle = '#374151';
            ctx.fillRect(enemy.x, enemy.y, 20, 24);
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(enemy.x + 2, enemy.y - 12, 16, 12);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(enemy.x + 2, enemy.y + 24, 16, 16);

            ctx.fillStyle = '#ef4444';
            ctx.fillRect(enemy.x, enemy.y - 18, 20, 3);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(enemy.x, enemy.y - 18, (enemy.hp / enemy.maxHp) * 20, 3);

            if (Math.abs(playerX - enemy.x) < 18 && Math.abs(playerY - enemy.y) < 25) {
              localGameOver = true;
              setGameOver(true);
              playArcadeSound('ko');
              recordScore(activeGame, playerName, localScore);
            }
          }
        }

        // =========================================================
        // 3. STREET FIGHTER II RETRO DUEL (RYU VS KEN 100% FUNCTIONAL)
        // =========================================================
        else if (activeGame === 'street-fighter') {
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(canvas.width / 2, 80, 40, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(0, canvas.height - 45, canvas.width, 45);
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(0, canvas.height - 42, canvas.width, 4);

          if ((keys['ArrowUp'] || keys['KeyW'] || keys['w']) && !isJumping) {
            playerVy = -8.5;
            isJumping = true;
            playArcadeSound('jump');
          }
          playerY += playerVy;
          if (playerY < canvas.height - 85) {
            playerVy += 0.5;
          } else {
            playerY = canvas.height - 85;
            playerVy = 0;
            isJumping = false;
          }

          isCrouching = !!(keys['ArrowDown'] || keys['KeyS'] || keys['s']) && !isJumping;

          if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) playerX = Math.max(30, playerX - 3.5);
          if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) playerX = Math.min(opponentX - 35, playerX + 3.5);

          if (punchTimer > 0) punchTimer--;
          if (kickTimer > 0) kickTimer--;
          if (hadoukenCooldown > 0) hadoukenCooldown--;

          const ryuY = isCrouching ? playerY + 15 : playerY;
          const ryuH = isCrouching ? 35 : 55;
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(playerX, ryuY, 32, ryuH);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(playerX - 2, ryuY + 25, 36, 6);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(playerX + 2, ryuY - 14, 28, 10);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(playerX + 4, ryuY - 18, 24, 6);

          if (punchTimer > 0) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(playerX + 30, ryuY + 10, 24, 10);
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(playerX + 54, ryuY + 9, 10, 12);
          }
          if (kickTimer > 0) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(playerX + 28, ryuY + 28, 30, 12);
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(playerX + 58, ryuY + 28, 10, 12);
          }

          opponentTimer++;
          if (opponentTimer > 40) {
            opponentTimer = 0;
            const dist = opponentX - playerX;
            if (dist > 120) {
              opponentState = 'walk';
            } else if (dist < 80) {
              opponentState = Math.random() > 0.5 ? 'punch' : 'kick';
              if (Math.abs(opponentX - playerX) < 75) {
                if (!isCrouching) {
                  playerHp = Math.max(0, playerHp - 10);
                  playArcadeSound('hit');
                  for (let p = 0; p < 5; p++) {
                    particles.push({
                      x: playerX + 15,
                      y: playerY + 10,
                      vx: (Math.random() - 0.5) * 6,
                      vy: (Math.random() - 0.5) * 6,
                      life: 10,
                      maxLife: 10,
                      color: '#facc15',
                      size: 3,
                    });
                  }
                  if (playerHp <= 0) {
                    localGameOver = true;
                    setGameOver(true);
                    playArcadeSound('ko');
                    recordScore(activeGame, playerName, localScore);
                  }
                }
              }
            } else {
              opponentState = 'idle';
            }
          }

          if (opponentState === 'walk' && opponentX > playerX + 65) {
            opponentX -= 1.8;
          }

          ctx.fillStyle = opponentState === 'hurt' ? '#ffffff' : '#dc2626';
          ctx.fillRect(opponentX, opponentY, 32, 55);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(opponentX - 2, opponentY + 25, 36, 6);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(opponentX + 2, opponentY - 18, 28, 14);

          if (opponentState === 'punch') {
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(opponentX - 22, opponentY + 10, 24, 10);
          }

          for (let b = bullets.length - 1; b >= 0; b--) {
            const fb = bullets[b];
            fb.x += fb.vx;

            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, fb.radius || 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, (fb.radius || 12) * 0.5, 0, Math.PI * 2);
            ctx.fill();

            if (fb.x > opponentX - 10 && fb.x < opponentX + 35) {
              opponentHp = Math.max(0, opponentHp - 25);
              localScore += 800;
              setScore(localScore);
              playArcadeSound('hit');
              opponentState = 'hurt';
              bullets.splice(b, 1);

              for (let p = 0; p < 14; p++) {
                particles.push({
                  x: opponentX,
                  y: opponentY + 10,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  life: 16,
                  maxLife: 16,
                  color: '#38bdf8',
                  size: 4,
                });
              }
              break;
            }

            if (bullets[b] && bullets[b].x > canvas.width) {
              bullets.splice(b, 1);
            }
          }

          // HP Bars
          ctx.fillStyle = '#334155';
          ctx.fillRect(20, 20, 180, 16);
          ctx.fillStyle = playerHp > 30 ? '#eab308' : '#ef4444';
          ctx.fillRect(20, 20, (playerHp / 100) * 180, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.fillText('RYU (1P)', 22, 16);

          ctx.fillStyle = '#334155';
          ctx.fillRect(canvas.width - 200, 20, 180, 16);
          ctx.fillStyle = opponentHp > 30 ? '#eab308' : '#ef4444';
          ctx.fillRect(canvas.width - 200 + (180 - (opponentHp / 100) * 180), 20, (opponentHp / 100) * 180, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText('KEN (2P)', canvas.width - 70, 16);

          if (opponentHp <= 0) {
            localVictory = true;
            localGameOver = true;
            setVictory(true);
            setGameOver(true);
            playArcadeSound('coin');
            recordScore(activeGame, playerName, localScore + 10000);
          }
        }

        // =========================================================
        // 4. CADILLACS E DINOSSAUROS BRAWL
        // =========================================================
        else {
          ctx.fillStyle = '#14532d';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#365314';
          ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

          if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) playerX = Math.max(30, playerX - 4);
          if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) playerX = Math.min(canvas.width - 50, playerX + 4);

          if ((keys['ArrowUp'] || keys['KeyW'] || keys['w']) && !isJumping) {
            playerVy = -8;
            isJumping = true;
            playArcadeSound('jump');
          }
          playerY += playerVy;
          if (playerY < canvas.height - 85) {
            playerVy += 0.5;
          } else {
            playerY = canvas.height - 85;
            playerVy = 0;
            isJumping = false;
          }

          if (punchTimer > 0) punchTimer--;

          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(playerX, playerY, 26, 32);
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(playerX + 2, playerY + 32, 22, 24);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(playerX + 4, playerY - 14, 18, 14);

          if (punchTimer > 0) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(playerX + 26, playerY + 8, 22, 10);
          }

          if (frameCount % 80 === 0) {
            enemies.push({
              x: canvas.width + 20,
              y: canvas.height - 85,
              hp: 3,
              maxHp: 3,
              type: Math.random() > 0.5 ? 'raptor' : 'poacher',
              vx: 2.2,
              shootCooldown: 0,
            });
          }

          for (let b = bullets.length - 1; b >= 0; b--) {
            const bullet = bullets[b];
            bullet.x += bullet.vx;
            ctx.fillStyle = '#f97316';
            ctx.fillRect(bullet.x, bullet.y, 12, 5);

            for (let e = enemies.length - 1; e >= 0; e--) {
              const enemy = enemies[e];
              if (
                bullet.x > enemy.x &&
                bullet.x < enemy.x + 35 &&
                bullet.y > enemy.y - 20 &&
                bullet.y < enemy.y + 40
              ) {
                enemy.hp--;
                bullets.splice(b, 1);
                playArcadeSound('hit');

                for (let p = 0; p < 6; p++) {
                  particles.push({
                    x: enemy.x + 10,
                    y: enemy.y + 10,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: 10,
                    maxLife: 10,
                    color: '#22c55e',
                    size: 3,
                  });
                }

                if (enemy.hp <= 0) {
                  enemies.splice(e, 1);
                  localScore += 650;
                  setScore(localScore);
                }
                break;
              }
            }

            if (bullets[b] && bullets[b].x > canvas.width) {
              bullets.splice(b, 1);
            }
          }

          for (let e = enemies.length - 1; e >= 0; e--) {
            const enemy = enemies[e];
            enemy.x -= enemy.vx;

            if (enemy.type === 'raptor') {
              ctx.fillStyle = '#15803d';
              ctx.fillRect(enemy.x, enemy.y, 40, 28);
              ctx.fillStyle = '#ca8a04';
              ctx.fillRect(enemy.x + 4, enemy.y + 4, 6, 6);
              ctx.fillStyle = '#14532d';
              ctx.fillRect(enemy.x + 38, enemy.y + 4, 18, 8);
            } else {
              ctx.fillStyle = '#b91c1c';
              ctx.fillRect(enemy.x, enemy.y, 24, 30);
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(enemy.x + 2, enemy.y + 30, 20, 20);
            }

            if (punchTimer > 0 && Math.abs(playerX + 26 - enemy.x) < 25) {
              enemy.hp--;
              playArcadeSound('hit');
              enemy.x += 20;
              if (enemy.hp <= 0) {
                enemies.splice(e, 1);
                localScore += 650;
                setScore(localScore);
              }
            }

            if (Math.abs(playerX - enemy.x) < 22 && Math.abs(playerY - enemy.y) < 25) {
              localGameOver = true;
              setGameOver(true);
              playArcadeSound('ko');
              recordScore(activeGame, playerName, localScore);
            }
          }
        }

        for (let p = particles.length - 1; p >= 0; p--) {
          const pt = particles[p];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life--;
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
          if (pt.life <= 0) {
            particles.splice(p, 1);
          }
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, 36);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`SCORE: ${localScore.toLocaleString()}`, 15, 24);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`PILOTO: ${playerName.toUpperCase()}`, canvas.width - 240, 24);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = localVictory ? '#22c55e' : '#ef4444';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(localVictory ? '🏆 K.O.! VITÓRIA TOTAL!' : 'GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '16px monospace';
        ctx.fillText(`SCORE FINAL: ${localScore.toLocaleString()}`, canvas.width / 2, canvas.height / 2 + 15);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '12px monospace';
        ctx.fillText('PRESSIONE "JOGAR NOVAMENTE" PARA REINICIAR', canvas.width / 2, canvas.height / 2 + 45);
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
      ref={modalRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(2, 6, 23, 0.95)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? '0' : '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isFullscreen ? '100vw' : '920px',
          height: isFullscreen ? '100vh' : 'auto',
          background: '#090d16',
          border: isFullscreen ? 'none' : '2px solid #38bdf8',
          borderRadius: isFullscreen ? '0' : '24px',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(56, 189, 248, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'popIn 0.2s ease-out',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '14px 22px',
            background: 'linear-gradient(to right, #0f172a, #1e1b4b)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🕹️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.04em' }}>
                  {gameTitles[activeGame]}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    background: victory ? '#22c55e' : isPlaying ? '#0284c7' : gameOver ? '#dc2626' : '#10b981',
                    color: '#fff',
                  }}
                >
                  {victory ? '🏆 VITÓRIA!' : isPlaying ? `SCORE: ${score.toLocaleString()}` : gameOver ? 'GAME OVER' : 'PRONTO'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                PUB REC RETRO ARCADE • MOTOR RETRO 100% OPERACIONAL
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '8px',
                color: '#38bdf8',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isFullscreen ? '⛶ Sair Tela Cheia' : '⛶ Tela Cheia'}
            </button>

            <button
              onClick={closeArcade}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#f87171',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '12px',
              }}
            >
              ✕ FECHAR
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '18px', gap: '18px', flex: 1 }}>
          <div style={{ flex: '1 1 520px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: '3px solid #1e293b',
                boxShadow: 'inset 0 0 25px rgba(0,0,0,0.9), 0 0 30px rgba(56, 189, 248, 0.25)',
                background: '#000',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <canvas
                ref={canvasRef}
                width={520}
                height={340}
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              />
            </div>

            <div
              style={{
                marginTop: '12px',
                width: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '11px',
                color: '#cbd5e1',
                fontFamily: 'monospace',
                background: 'rgba(15, 23, 42, 0.7)',
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid #1e293b',
              }}
            >
              {activeGame === 'street-fighter' ? (
                <>
                  <span>⌨️ <strong>WASD</strong>: Mover/Pular/Agachar</span>
                  <span>•</span>
                  <span><strong>J</strong>: Soco</span>
                  <span>•</span>
                  <span><strong>K</strong>: Chute</span>
                  <span>•</span>
                  <span style={{ color: '#38bdf8' }}><strong>L / ESPAÇO</strong>: HADOUKEN!</span>
                </>
              ) : activeGame === 'metal-slug' ? (
                <>
                  <span>⌨️ <strong>WASD / Setas</strong>: Mover & Pular</span>
                  <span>•</span>
                  <span style={{ color: '#facc15' }}><strong>ESPAÇO / J / Z</strong>: Tiro Contínuo</span>
                </>
              ) : activeGame === 'cadillacs' ? (
                <>
                  <span>⌨️ <strong>WASD</strong>: Mover & Pular</span>
                  <span>•</span>
                  <span><strong>J</strong>: Soco Combo</span>
                  <span>•</span>
                  <span style={{ color: '#f97316' }}><strong>ESPAÇO / L</strong>: Tiro de Espingarda</span>
                </>
              ) : (
                <>
                  <span>⌨️ <strong>A / D / Setas</strong>: Direção</span>
                  <span>•</span>
                  <span>Desvie dos rivais e acelere!</span>
                </>
              )}
            </div>
          </div>

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
                  PUB REC FLIPERAMA
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

            <div style={{ marginTop: '16px', borderTop: '1px solid #334155', paddingTop: '12px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Nome do Jogador:
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
