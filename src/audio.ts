// ============================================================
// AUDIO MANAGER — Procedural Web Audio SFX + Ambient
// ============================================================

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientPad: OscillatorNode | null = null;
  masterVol = 1;
  sfxVol = 1;
  musicVol = 0.4;

  private init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.updateVolumes();
  }

  updateVolumes() {
    if (this.masterGain) this.masterGain.gain.value = this.masterVol;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol;
    if (this.musicGain) this.musicGain.gain.value = this.musicVol;
  }

  startAmbient() {
    this.init();
    if (!this.ctx || !this.musicGain || this.ambientOsc) return;
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = 55;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(this.ambientOsc.frequency);
    lfo.start();
    const g = this.ctx.createGain();
    g.gain.value = 0.08;
    this.ambientOsc.connect(g);
    g.connect(this.musicGain);
    this.ambientOsc.start();
    this.ambientPad = this.ctx.createOscillator();
    this.ambientPad.type = 'triangle';
    this.ambientPad.frequency.value = 110;
    const pg = this.ctx.createGain();
    pg.gain.value = 0.04;
    this.ambientPad.connect(pg);
    pg.connect(this.musicGain);
    this.ambientPad.start();
  }

  stopAmbient() {
    try { this.ambientOsc?.stop(); } catch {}
    try { this.ambientPad?.stop(); } catch {}
    this.ambientOsc = null;
    this.ambientPad = null;
  }

  playBounce(intensity = 0.5) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200 + intensity * 300, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.1 * intensity, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    ns.connect(ng);
    ng.connect(this.sfxGain);
    ns.start(t);
  }

  playRimHit() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playSwish() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.3));
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2000, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    bp.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    ns.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    ns.start(t);
    [660, 880, 1100].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = this.ctx!.createGain();
      og.gain.setValueAtTime(0, t + i * 0.08);
      og.gain.linearRampToValueAtTime(0.08, t + i * 0.08 + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2);
      o.connect(og);
      og.connect(this.sfxGain!);
      o.start(t + i * 0.08);
      o.stop(t + i * 0.08 + 0.25);
    });
  }

  playMiss() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  playMake() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0, t + i * 0.06);
      g.gain.linearRampToValueAtTime(0.1, t + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.3);
      o.connect(g);
      g.connect(this.sfxGain!);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.35);
    });
  }

  playThrow() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.5));
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    ns.connect(hp);
    hp.connect(g);
    g.connect(this.sfxGain);
    ns.start(t);
  }

  playGameStart() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [262, 330, 392, 523].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0, t + i * 0.1);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
      o.connect(g);
      g.connect(this.sfxGain!);
      o.start(t + i * 0.1);
      o.stop(t + i * 0.1 + 0.35);
    });
  }

  playGameOver() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [784, 659, 523, 392].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = this.ctx!.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2000;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0, t + i * 0.15);
      g.gain.linearRampToValueAtTime(0.06, t + i * 0.15 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.4);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.sfxGain!);
      o.start(t + i * 0.15);
      o.stop(t + i * 0.15 + 0.45);
    });
  }

  playCountdownTick() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 880;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.12);
  }

  playAchievement() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0, t + i * 0.07);
      g.gain.linearRampToValueAtTime(0.06, t + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.4);
      o.connect(g);
      g.connect(this.sfxGain!);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.45);
    });
  }

  playButtonClick() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.08);
  }

  playBackboardHit() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(100, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.2);
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.2;
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.1, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    ns.connect(ng);
    ng.connect(this.sfxGain);
    ns.start(t);
  }

  playBounceFloor() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.2);
  }

  /** Crowd cheer with layered noise */
  playCrowdCheer(intensity = 1.0) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const duration = 1.5 * intensity;
    // Crowd noise base
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const env = Math.sin((i / d.length) * Math.PI);
      d[i] = (Math.random() * 2 - 1) * env * 0.4;
    }
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15 * intensity, t);
    g.gain.linearRampToValueAtTime(0.25 * intensity, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    ns.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    ns.start(t);
    // Whistles
    [1200, 1600].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.frequency.setValueAtTime(f, t + 0.2 + i * 0.3);
      o.frequency.linearRampToValueAtTime(f * 1.2, t + 0.4 + i * 0.3);
      o.frequency.linearRampToValueAtTime(f, t + 0.6 + i * 0.3);
      const og = this.ctx!.createGain();
      og.gain.setValueAtTime(0, t + 0.2 + i * 0.3);
      og.gain.linearRampToValueAtTime(0.03 * intensity, t + 0.3 + i * 0.3);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.8 + i * 0.3);
      o.connect(og);
      og.connect(this.sfxGain!);
      o.start(t + 0.2 + i * 0.3);
      o.stop(t + 1.0 + i * 0.3);
    });
  }

  /** Net swoosh — softer rustling than swish, for makes that aren't swishes */
  playNetSwoosh() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const env = Math.sin((i / d.length) * Math.PI) * 0.5;
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 1.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    ns.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    ns.start(t);
  }

  /** Charging hum — a slowly rising tone while powering up */
  playChargeHum(power: number) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const freq = 100 + power * 400;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.03 * power, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Perfect shot chime — plays for high-scoring shots */
  playPerfectShot() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175, 1568, 1976].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0, t + i * 0.06);
      g.gain.linearRampToValueAtTime(0.07, t + i * 0.06 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.35);
      o.connect(g);
      g.connect(this.sfxGain!);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.4);
    });
  }

  /** Ball dribble sound — for idle ball animation */
  playDribble() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Impact thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
    // High slap
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.03, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.15;
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    ns.connect(ng);
    ng.connect(this.sfxGain);
    ns.start(t);
  }

  /** Streak break — descending tone when streak ends */
  playStreakBreak() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.3);
  }
}
