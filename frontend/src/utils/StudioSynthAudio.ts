export type DrumComponent = 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'tom_high' | 'tom_low' | 'floor_tom' | 'crash' | 'ride';

export type InstrumentCategory = 'keys' | 'drums' | 'guitar' | 'sax' | 'percussion' | 'synth';

export type SynthPreset = 
  | 'moog_bass' 
  | 'juno_pad' 
  | 'dx7_epiano' 
  | '808_sub' 
  | 'supersaw_lead' 
  | 'pluck_synth';

export interface NoteEvent {
  id: string;
  noteOrPiece: string;
  freq?: number;
  time: number;
  duration: number;
}

export interface MasterPluginSettings {
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  compMakeup: number;
  lufsTarget: number;
  limiterCeiling: number;
  enabled: boolean;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private eqLowNode: BiquadFilterNode | null = null;
  private eqMidNode: BiquadFilterNode | null = null;
  private eqHighNode: BiquadFilterNode | null = null;
  private compNode: DynamicsCompressorNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  public masterSettings: MasterPluginSettings = {
    eqLow: 2,
    eqMid: 0,
    eqHigh: 3,
    compThreshold: -16,
    compRatio: 3.5,
    compAttack: 0.015,
    compRelease: 0.25,
    compMakeup: 3,
    lufsTarget: -14,
    limiterCeiling: -0.1,
    enabled: true
  };

  getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
        this.setupMasterBus();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private setupMasterBus() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

    this.eqLowNode = ctx.createBiquadFilter();
    this.eqLowNode.type = 'lowshelf';
    this.eqLowNode.frequency.setValueAtTime(100, ctx.currentTime);
    this.eqLowNode.gain.setValueAtTime(this.masterSettings.eqLow, ctx.currentTime);

    this.eqMidNode = ctx.createBiquadFilter();
    this.eqMidNode.type = 'peaking';
    this.eqMidNode.frequency.setValueAtTime(1500, ctx.currentTime);
    this.eqMidNode.Q.setValueAtTime(1.0, ctx.currentTime);
    this.eqMidNode.gain.setValueAtTime(this.masterSettings.eqMid, ctx.currentTime);

    this.eqHighNode = ctx.createBiquadFilter();
    this.eqHighNode.type = 'highshelf';
    this.eqHighNode.frequency.setValueAtTime(8000, ctx.currentTime);
    this.eqHighNode.gain.setValueAtTime(this.masterSettings.eqHigh, ctx.currentTime);

    this.compNode = ctx.createDynamicsCompressor();
    this.compNode.threshold.setValueAtTime(this.masterSettings.compThreshold, ctx.currentTime);
    this.compNode.ratio.setValueAtTime(this.masterSettings.compRatio, ctx.currentTime);
    this.compNode.attack.setValueAtTime(this.masterSettings.compAttack, ctx.currentTime);
    this.compNode.release.setValueAtTime(this.masterSettings.compRelease, ctx.currentTime);

    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.setValueAtTime(-0.5, ctx.currentTime);
    this.limiterNode.ratio.setValueAtTime(20.0, ctx.currentTime);
    this.limiterNode.attack.setValueAtTime(0.001, ctx.currentTime);
    this.limiterNode.release.setValueAtTime(0.05, ctx.currentTime);

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;

    this.masterGain.connect(this.eqLowNode);
    this.eqLowNode.connect(this.eqMidNode);
    this.eqMidNode.connect(this.eqHighNode);
    this.eqHighNode.connect(this.compNode);
    this.compNode.connect(this.limiterNode);
    this.limiterNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);
  }

  getMasterInputNode(): AudioNode | null {
    this.getContext();
    return this.masterGain;
  }

  updateMasterSettings(newSettings: Partial<MasterPluginSettings>) {
    this.masterSettings = { ...this.masterSettings, ...newSettings };
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (this.eqLowNode && newSettings.eqLow !== undefined) {
      this.eqLowNode.gain.setValueAtTime(newSettings.eqLow, now);
    }
    if (this.eqMidNode && newSettings.eqMid !== undefined) {
      this.eqMidNode.gain.setValueAtTime(newSettings.eqMid, now);
    }
    if (this.eqHighNode && newSettings.eqHigh !== undefined) {
      this.eqHighNode.gain.setValueAtTime(newSettings.eqHigh, now);
    }
    if (this.compNode) {
      if (newSettings.compThreshold !== undefined) this.compNode.threshold.setValueAtTime(newSettings.compThreshold, now);
      if (newSettings.compRatio !== undefined) this.compNode.ratio.setValueAtTime(newSettings.compRatio, now);
      if (newSettings.compAttack !== undefined) this.compNode.attack.setValueAtTime(newSettings.compAttack, now);
      if (newSettings.compRelease !== undefined) this.compNode.release.setValueAtTime(newSettings.compRelease, now);
    }
  }

  getMeterLevel(): { peak: number; lufsEst: number } {
    if (!this.analyserNode) return { peak: -60, lufsEst: -60 };
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      const absVal = Math.abs(normalized);
      if (absVal > peak) peak = absVal;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / data.length);
    const peakDb = peak > 0.0001 ? 20 * Math.log10(peak) : -60;
    const lufsEst = rms > 0.0001 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms) - 3.1)) : -60;

    return { peak: Math.round(peakDb), lufsEst: Math.round(lufsEst * 10) / 10 };
  }

  playPiano(frequency: number, duration: number = 0.8, customDest?: AudioNode) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = customDest || this.getMasterInputNode() || ctx.destination;

    const oscFundamental = ctx.createOscillator();
    const oscHarmonic = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscFundamental.type = 'sine';
    oscHarmonic.type = 'triangle';
    oscFundamental.frequency.setValueAtTime(frequency, now);
    oscHarmonic.frequency.setValueAtTime(frequency * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 4, now);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.2, now + duration);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscFundamental.connect(filter);
    oscHarmonic.connect(filter);
    filter.connect(gain);
    gain.connect(target);

    oscFundamental.start(now);
    oscHarmonic.start(now);
    oscFundamental.stop(now + duration);
    oscHarmonic.stop(now + duration);
  }

  playSynth(frequency: number, preset: SynthPreset = 'supersaw_lead', duration: number = 0.7, customDest?: AudioNode) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = customDest || this.getMasterInputNode() || ctx.destination;

    switch (preset) {
      case 'moog_bass': {
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        sub.type = 'square';
        osc.frequency.setValueAtTime(frequency * 0.5, now);
        sub.frequency.setValueAtTime(frequency * 0.25, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(140, now + duration);
        filter.Q.setValueAtTime(6, now);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(filter);
        sub.connect(filter);
        filter.connect(gain);
        gain.connect(target);

        osc.start(now);
        sub.start(now);
        osc.stop(now + duration);
        sub.stop(now + duration);
        break;
      }

      case 'juno_pad': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(frequency, now);
        osc2.frequency.setValueAtTime(frequency * 1.008, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.linearRampToValueAtTime(3200, now + duration * 0.5);
        filter.frequency.exponentialRampToValueAtTime(800, now + duration);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(target);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
        break;
      }

      case 'dx7_epiano': {
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();
        const gain = ctx.createGain();

        carrier.type = 'sine';
        modulator.type = 'sine';
        carrier.frequency.setValueAtTime(frequency, now);
        modulator.frequency.setValueAtTime(frequency * 3.5, now);

        modGain.gain.setValueAtTime(frequency * 1.5, now);
        modGain.gain.exponentialRampToValueAtTime(1, now + duration);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        carrier.connect(gain);
        gain.connect(target);

        carrier.start(now);
        modulator.start(now);
        carrier.stop(now + duration);
        modulator.stop(now + duration);
        break;
      }

      case '808_sub': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency > 100 ? frequency * 0.25 : frequency, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + duration * 0.8);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(target);

        osc.start(now);
        osc.stop(now + duration);
        break;
      }

      case 'pluck_synth': {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4500, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.25);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(target);

        osc.start(now);
        osc.stop(now + 0.35);
        break;
      }

      case 'supersaw_lead':
      default: {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc3.type = 'sawtooth';

        osc1.frequency.setValueAtTime(frequency, now);
        osc2.frequency.setValueAtTime(frequency * 1.006, now);
        osc3.frequency.setValueAtTime(frequency * 0.994, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(frequency * 4.5, now);
        filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(gain);
        gain.connect(target);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
        osc3.stop(now + duration);
        break;
      }
    }
  }

  playGuitar(frequency: number, duration: number = 1.0, customDest?: AudioNode) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = customDest || this.getMasterInputNode() || ctx.destination;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency * 1.8, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(target);

    osc.start(now);
    osc.stop(now + duration);
  }

  playSaxophone(frequency: number, duration: number = 0.9, customDest?: AudioNode) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = customDest || this.getMasterInputNode() || ctx.destination;

    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, now);

    vibrato.frequency.setValueAtTime(5.5, now);
    vibratoGain.gain.setValueAtTime(3.5, now);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    filter.type = 'peaking';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(4.0, now);
    filter.gain.setValueAtTime(10, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(target);

    vibrato.start(now);
    osc.start(now);
    vibrato.stop(now + duration);
    osc.stop(now + duration);
  }

  triggerPercussion(type: 'conga' | 'bongo' | 'shaker' | 'cowbell' | 'clap', customDest?: AudioNode) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = customDest || this.getMasterInputNode() || ctx.destination;

    if (type === 'conga' || type === 'bongo') {
      const freq = type === 'conga' ? 180 : 340;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.18);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(target);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'shaker') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.07);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(target);
      noise.start(now);
      noise.stop(now + 0.07);
    } else if (type === 'cowbell') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(587, now);
      osc2.frequency.setValueAtTime(845, now);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(700, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(target);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.16);
      osc2.stop(now + 0.16);
    } else {
      const bufferSize = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(2.0, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(target);
      noise.start(now);
      noise.stop(now + 0.12);
    }
  }

  triggerDrum(piece: DrumComponent, customDest?: AudioNode) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = customDest || this.getMasterInputNode() || ctx.destination;

    switch (piece) {
      case 'kick': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(target);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case 'snare': {
        const bufferSize = Math.floor(ctx.sampleRate * 0.15);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(target);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        oscGain.gain.setValueAtTime(0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(oscGain);
        oscGain.connect(target);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.15);
        osc.stop(now + 0.15);
        break;
      }
      case 'hihat_closed':
      case 'hihat_open': {
        const isOpen = piece === 'hihat_open';
        const duration = isOpen ? 0.32 : 0.05;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = isOpen ? 6000 : 7500;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(isOpen ? 0.4 : 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(target);
        noise.start(now);
        noise.stop(now + duration);
        break;
      }
      case 'tom_high':
      case 'tom_low':
      case 'floor_tom': {
        const freq = piece === 'tom_high' ? 190 : piece === 'tom_low' ? 135 : 95;
        const duration = piece === 'floor_tom' ? 0.35 : 0.24;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(target);
        osc.start(now);
        osc.stop(now + duration);
        break;
      }
      case 'crash':
      case 'ride': {
        const duration = piece === 'crash' ? 1.2 : 0.8;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = piece === 'crash' ? 4500 : 6500;
        filter.Q.value = 1.2;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(piece === 'crash' ? 0.6 : 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(target);
        noise.start(now);
        noise.stop(now + duration);
        break;
      }
    }
  }

  playNote(frequency: number, _waveType: OscillatorType = 'sawtooth', duration: number = 0.8) {
    this.playPiano(frequency, duration);
  }

  playDrumPattern() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.triggerDrum('kick');
    setTimeout(() => this.triggerDrum('hihat_closed'), 150);
    setTimeout(() => this.triggerDrum('snare'), 300);
    setTimeout(() => this.triggerDrum('kick'), 450);
  }

  playSynthAndGuitar() {
    this.playSynth(261.63, 'supersaw_lead', 1.2);
    this.playGuitar(329.63, 1.2);
  }

  playConsoleEffect() {
    this.playSynth(130.81, 'moog_bass', 0.9);
  }

  async exportToWav(
    tracksData: Array<{
      category: InstrumentCategory;
      preset?: string;
      events: NoteEvent[];
    }>,
    bpm: number,
    totalBars: number = 4
  ): Promise<Blob> {
    const totalSeconds = Math.max(3, (60 / bpm) * 4 * totalBars + 1);
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.floor(sampleRate * totalSeconds), sampleRate);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(1.0, 0);

    const eqLow = offlineCtx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.setValueAtTime(100, 0);
    eqLow.gain.setValueAtTime(this.masterSettings.eqLow, 0);

    const eqHigh = offlineCtx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.setValueAtTime(8000, 0);
    eqHigh.gain.setValueAtTime(this.masterSettings.eqHigh, 0);

    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(this.masterSettings.compThreshold, 0);
    comp.ratio.setValueAtTime(this.masterSettings.compRatio, 0);

    masterGain.connect(eqLow);
    eqLow.connect(eqHigh);
    eqHigh.connect(comp);
    comp.connect(offlineCtx.destination);

    tracksData.forEach((track) => {
      track.events.forEach((evt) => {
        const time = Math.max(0, evt.time);
        const dur = evt.duration || 0.5;

        if (track.category === 'drums') {
          const piece = evt.noteOrPiece as DrumComponent;
          if (piece === 'kick') {
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(35, time + 0.18);
            gain.gain.setValueAtTime(1.0, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(time);
            osc.stop(time + 0.2);
          } else {
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            osc.frequency.setValueAtTime(200, time);
            gain.gain.setValueAtTime(0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(time);
            osc.stop(time + dur);
          }
        } else {
          const osc = offlineCtx.createOscillator();
          const gain = offlineCtx.createGain();
          osc.type = track.category === 'synth' ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(evt.freq || 261.63, time);
          gain.gain.setValueAtTime(0.35, time);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(time);
          osc.stop(time + dur);
        }
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWavBlob(renderedBuffer);
  }

  private audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = buffer.length * blockAlign;
    const bufferArray = new ArrayBuffer(44 + dataSize);
    const view = new DataView(bufferArray);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }

    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        sample = Math.max(-1, Math.min(1, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([bufferArray], { type: 'audio/wav' });
  }
}

export const studioSynthAudio = new StudioAudioEngine();

