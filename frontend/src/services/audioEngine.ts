/**
 * Web Audio API Vinyl Player & Procedural Music Synthesizer
 * Generates authentic vinyl surface noise + procedural melodic themes.
 */

class OfficeAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private timerId: any = null;
  private currentAlbumId = 'album-synth';

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. Gera ruído característico de vinil (crackle & pops analógicos)
  private startVinylCrackle() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Pink noise suave de fundo
      const white = Math.random() * 2 - 1;
      // Estalos aleatórios de poeira no sulco do vinil
      const isPop = Math.random() < 0.0008;
      output[i] = white * 0.012 + (isPop ? (Math.random() * 0.2 - 0.1) : 0);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();
    this.noiseNode = noise;
  }

  // 2. Toca notas e acordes procedurais por álbum
  private playNote(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.1) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Escalas musicais
  private getNotesForAlbum(albumId: string): { notes: number[]; type: OscillatorType; intervalMs: number } {
    switch (albumId) {
      case 'album-bossa':
        // Bossa Jazz (Dó maior com 7M / Lá menor 9)
        return {
          notes: [261.63, 329.63, 392.00, 493.88, 440.00, 523.25, 349.23, 293.66],
          type: 'triangle',
          intervalMs: 800,
        };
      case 'album-8bit':
        // 8-bit Chiptune Arpeggios rápidos
        return {
          notes: [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 587.33, 880.00],
          type: 'square',
          intervalMs: 220,
        };
      case 'album-rock':
        // Pentatônica Menor pesada
        return {
          notes: [146.83, 174.61, 196.00, 220.00, 261.63, 293.66, 220.00],
          type: 'sawtooth',
          intervalMs: 380,
        };
      case 'album-idm':
        // Texturas minimalistas e atmosféricas
        return {
          notes: [440.00, 554.37, 659.25, 830.61, 440.00, 329.63],
          type: 'sine',
          intervalMs: 1100,
        };
      case 'album-lofi':
        // Lo-Fi Chillhop suave
        return {
          notes: [220.00, 277.18, 329.63, 415.30, 369.99, 293.66],
          type: 'sine',
          intervalMs: 900,
        };
      case 'album-synth':
      default:
        // Synthwave 80s arpeggio clássico (Am - F - C - G)
        return {
          notes: [220.00, 261.63, 329.63, 440.00, 174.61, 261.63, 349.23, 196.00],
          type: 'sawtooth',
          intervalMs: 400,
        };
    }
  }

  public play(albumId = 'album-synth') {
    this.initContext();
    this.stop();
    this.isPlaying = true;
    this.currentAlbumId = albumId;

    this.startVinylCrackle();

    const config = this.getNotesForAlbum(albumId);
    let noteIdx = 0;

    this.timerId = setInterval(() => {
      if (!this.isPlaying) return;
      const freq = config.notes[noteIdx % config.notes.length];
      const duration = (config.intervalMs / 1000) * 1.5;
      const gainVal = config.type === 'square' ? 0.04 : config.type === 'sawtooth' ? 0.05 : 0.08;
      this.playNote(freq, duration, config.type, gainVal);
      noteIdx++;
    }, config.intervalMs);
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {
        // ignore
      }
      this.noiseNode = null;
    }
  }

  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, val));
      this.masterGain.gain.setValueAtTime(clamped * 0.4, this.ctx.currentTime);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentAlbumId(): string {
    return this.currentAlbumId;
  }
}

export const defaultAudioEngine = new OfficeAudioEngine();
