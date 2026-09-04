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
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Toque característico de descida da agulha no vinil (needle drop thump)
  private playNeedleDrop() {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(65, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch {}
  }

  // 1. Gera ruído autêntico e audível de vinil (crackle, estalos analógicos e hiss de superfície)
  private startVinylCrackle() {
    if (!this.ctx || !this.masterGain) return;
    this.playNeedleDrop();

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Ruído de superfície analógica
      const white = Math.random() * 2 - 1;
      // Estalos e ranhuras perceptíveis no sulco do vinil
      const isPop = Math.random() < 0.0035;
      output[i] = white * 0.038 + (isPop ? (Math.random() * 0.4 - 0.2) : 0);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();
    this.noiseNode = noise;
  }

  public play(albumId = 'album-pubrecords') {
    this.initContext();
    this.stop();
    this.isPlaying = true;
    this.currentAlbumId = albumId;

    // Apenas o ruído analógico característico do vinil (agulha descendo e estalos suaves)
    // ZERO música mock sintetizada: a música real vem 100% das faixas do SoundCloud da PUB Records
    this.startVinylCrackle();
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
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, val));
      this.masterGain.gain.setValueAtTime(clamped * 1.0, this.ctx.currentTime);
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
