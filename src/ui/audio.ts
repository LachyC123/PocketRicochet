// Code-synthesised sound palette (no sample files, nothing to license). Starts only after a
// user gesture; if the browser blocks audio, gameplay is unaffected.

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const MAX_DEBRIS_VOICES = 5;

export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private debrisEnds: number[] = [];

  /** Call from a pointer/touch handler. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.5);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(filter: BiquadFilterType, freq: number, q: number, dur: number, vol: number, sweepTo?: number): void {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(freq, t);
    if (sweepTo) biquad.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    biquad.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biquad).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }

  /** Debris sounds share a small voice budget; important cues bypass it. */
  private claimDebrisVoice(dur: number): boolean {
    const ctx = this.ready();
    if (!ctx) return false;
    const now = ctx.currentTime;
    this.debrisEnds = this.debrisEnds.filter((end) => end > now);
    if (this.debrisEnds.length >= MAX_DEBRIS_VOICES) return false;
    this.debrisEnds.push(now + dur);
    return true;
  }

  private scaleFreq(base: number, ordinal: number): number {
    const step = PENTATONIC[Math.min(Math.max(ordinal - 1, 0), PENTATONIC.length - 1)];
    return base * Math.pow(2, step / 12);
  }

  launch(): void {
    this.tone('sine', 260, 620, 0.09, 0.35);
    this.burst('highpass', 2500, 0.7, 0.03, 0.12);
  }

  wall(): void {
    if (!this.claimDebrisVoice(0.05)) return;
    this.burst('bandpass', 1900, 4, 0.045, 0.22);
  }

  crate(ordinal: number): void {
    if (!this.claimDebrisVoice(0.14)) return;
    this.tone('triangle', this.scaleFreq(330, ordinal), this.scaleFreq(220, ordinal), 0.12, 0.32);
    this.burst('bandpass', 1300, 2, 0.08, 0.25);
  }

  splat(ordinal: number): void {
    if (!this.claimDebrisVoice(0.2)) return;
    this.tone('sine', this.scaleFreq(240, ordinal), 80, 0.18, 0.4);
    this.burst('lowpass', 1400, 1, 0.18, 0.35, 250);
  }

  bell(): void {
    this.tone('sine', 1318, 1310, 0.7, 0.22);
    this.tone('sine', 1975, 1970, 0.45, 0.1);
    this.tone('triangle', 2637, 2630, 0.2, 0.05);
  }

  bellDull(): void {
    if (!this.claimDebrisVoice(0.12)) return;
    this.tone('sine', 880, 860, 0.12, 0.08);
  }

  returnCue(): void {
    this.burst('bandpass', 500, 3, 0.35, 0.18, 2200);
    this.tone('sine', 520, 780, 0.25, 0.08);
  }

  catch(perfect: boolean): void {
    this.tone('sine', 150, 70, 0.14, 0.55);
    this.burst('lowpass', 600, 1, 0.08, 0.3);
    if (perfect) {
      [1046, 1318, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.12, 0.06 + i * 0.06));
    }
  }

  miss(): void {
    this.tone('triangle', 420, 110, 0.45, 0.25);
  }

  newBest(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.12, i * 0.08));
  }
}
