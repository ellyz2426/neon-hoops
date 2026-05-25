import {
  World,
  PanelUI,
  PanelDocument,
  ScreenSpace,
  Follower,
  FollowBehavior,
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  TorusGeometry,
  RingGeometry,
  ConeGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  LineBasicMaterial,
  Color,
  Vector3,
  Quaternion,
  Euler,
  Fog,
  AmbientLight,
  PointLight,
  DirectionalLight,
  BufferGeometry,
  Float32BufferAttribute,
  EdgesGeometry,
  LineSegments,
  AdditiveBlending,
  Raycaster,
  Vector2,
  InputComponent,
} from '@iwsdk/core';
import type { UIKitDocument } from '@iwsdk/core';

// ============================================================
// TYPES & CONFIG
// ============================================================

type GameState = 'title' | 'modeselect' | 'difficulty' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'leaderboard' | 'achievements' | 'settings' | 'help';
type GameMode = 'freethrow' | 'threepoint' | 'arcade' | 'horse' | 'trickshot' | 'practice';

interface ShotResult {
  made: boolean;
  swish: boolean;
  bankShot: boolean;
  points: number;
  distance: number;
}

interface Achievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

interface LeaderboardEntry {
  score: number;
  mode: string;
  accuracy: number;
  date: string;
}

interface CourtTheme {
  name: string;
  court: number;
  lines: number;
  rim: number;
  backboard: number;
  accent: number;
  fog: number;
}

const THEMES: CourtTheme[] = [
  { name: 'Neon Arena', court: 0x001122, lines: 0xff6600, rim: 0xff4400, backboard: 0x00aaff, accent: 0xff6600, fog: 0x000811 },
  { name: 'Cyberpunk', court: 0x110022, lines: 0xff00ff, rim: 0xff0088, backboard: 0x8800ff, accent: 0xff00ff, fog: 0x080011 },
  { name: 'Arctic Court', court: 0x001133, lines: 0x00ccff, rim: 0x0088ff, backboard: 0x44ddff, accent: 0x00ccff, fog: 0x000a1a },
  { name: 'Solar Blaze', court: 0x221100, lines: 0xffaa00, rim: 0xff6600, backboard: 0xffcc00, accent: 0xffaa00, fog: 0x110800 },
  { name: 'Toxic Green', court: 0x002211, lines: 0x00ff66, rim: 0x00cc44, backboard: 0x44ff88, accent: 0x00ff66, fog: 0x001108 },
];

const ACHIEVEMENTS_DEF: { id: string; name: string; desc: string }[] = [
  { id: 'first_basket', name: 'First Basket', desc: 'Make your first shot' },
  { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Make 5 in a row' },
  { id: 'perfect_10', name: 'Perfect 10', desc: '10/10 in Free Throw' },
  { id: 'downtown', name: 'Downtown', desc: 'Hit a three-pointer' },
  { id: 'swish_master', name: 'Swish Master', desc: '5 swishes in one game' },
  { id: 'bank_artist', name: 'Bank Artist', desc: '3 bank shots in one game' },
  { id: 'on_fire', name: 'On Fire', desc: '10 shot streak' },
  { id: 'century', name: 'Century Club', desc: 'Score 100+ in one game' },
  { id: 'marksman', name: 'Marksman', desc: '80%+ accuracy (10+ shots)' },
  { id: 'long_range', name: 'Long Range', desc: 'Make a half-court shot' },
  { id: 'trick_master', name: 'Trick Master', desc: 'Complete all trick shots' },
  { id: 'horse_winner', name: 'Horse Tamer', desc: 'Win a game of H.O.R.S.E.' },
  { id: 'arcade_50', name: 'Arcade Star', desc: 'Score 50+ in Arcade' },
  { id: 'arcade_100', name: 'Arcade Legend', desc: 'Score 100+ in Arcade' },
  { id: 'three_pt_20', name: 'Downtown Sniper', desc: '20+ in Three-Point Contest' },
  { id: 'no_miss', name: 'Untouchable', desc: 'Win H.O.R.S.E. with no misses' },
  { id: 'games_10', name: 'Regular', desc: 'Play 10 games' },
  { id: 'games_50', name: 'Veteran', desc: 'Play 50 games' },
  { id: 'total_100', name: 'Centurion', desc: 'Make 100 total shots' },
  { id: 'total_500', name: 'Hall of Famer', desc: 'Make 500 total shots' },
];

// Physics constants
const GRAVITY = -9.81;
const BALL_RADIUS = 0.12;
const RIM_RADIUS = 0.225;
const RIM_HEIGHT = 3.05;
const BACKBOARD_WIDTH = 1.8;
const BACKBOARD_HEIGHT = 1.05;
const FREE_THROW_DIST = 4.6;
const THREE_POINT_DIST = 7.24;
const HALF_COURT_DIST = 14.0;

// ============================================================
// AUDIO MANAGER
// ============================================================

class AudioManager {
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
    // Deep ambient drone
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
    // Pad
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
    // Noise burst
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
    // Swoosh noise
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
    // Celebratory chime
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
    // Noise
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
}

// ============================================================
// MAIN GAME
// ============================================================

async function main() {
  const container = document.getElementById('app') as HTMLDivElement;

  const world = await World.create(container, {
    xr: { offer: 'once' as const },
    input: { canvasPointerEvents: true },
    features: {
      grabbing: true,
      locomotion: false,
      physics: true,
      spatialUI: true,
    },
    render: {
      near: 0.01,
      far: 200,
      camera: { position: [0, 1.7, 6], lookAt: [0, 3.05, 0] },
    },
  } as any);

  const audio = new AudioManager();

  // ============================================================
  // GAME STATE
  // ============================================================

  let gameState: GameState = 'title';
  let gameMode: GameMode = 'freethrow';
  let score = 0;
  let shotsMade = 0;
  let shotsTaken = 0;
  let streak = 0;
  let bestStreak = 0;
  let swishCount = 0;
  let bankShotCount = 0;
  let totalGamesPlayed = 0;
  let totalShotsMadeAll = 0;
  let themeIndex = 0;
  let paused = false;

  // Ball physics state
  let ballPos = new Vector3(0, 1.2, FREE_THROW_DIST);
  let ballVel = new Vector3(0, 0, 0);
  let ballInFlight = false;
  let ballSettled = false;
  let shotProcessed = false;
  let settleTimer = 0;
  let ballBounceCount = 0;

  // Throw input state (browser)
  let isCharging = false;
  let chargeStart = 0;
  let chargePower = 0;
  let aimX = 0;
  let mouseY = 0;

  // Mode-specific state
  let arcadeLevel = 1;
  let arcadeTimeLeft = 30;
  let horseLetters = ['', ''];
  let horseCurrentShooter = 0;
  let horseChallengeShot: { pos: Vector3; result: ShotResult } | null = null;
  let trickShotIndex = 0;
  let threePointRack = 0;
  let threePointBallInRack = 0;
  let threePointScore = 0;
  let threePointTimeLeft = 60;

  // Countdown state
  let countdownValue = 3;
  let countdownTimer = 0;

  // Particles
  const particles: { mesh: Mesh; vel: Vector3; life: number; maxLife: number }[] = [];
  const MAX_PARTICLES = 80;

  // Ball trail
  const trailPoints: { pos: Vector3; age: number }[] = [];

  // Shot positions for modes
  const shotPositions = {
    freethrow: new Vector3(0, 0, FREE_THROW_DIST),
    threepoint: [
      new Vector3(-5, 0, 4), new Vector3(-3, 0, 6.5), new Vector3(0, 0, THREE_POINT_DIST),
      new Vector3(3, 0, 6.5), new Vector3(5, 0, 4),
    ],
    halfcourt: new Vector3(0, 0, HALF_COURT_DIST),
  };

  // Trick shots
  const trickShots = [
    { name: 'Nothing But Net', desc: 'Swish from free throw', pos: new Vector3(0, 0, FREE_THROW_DIST), requireSwish: true },
    { name: 'Bank It', desc: 'Bank shot off backboard', pos: new Vector3(2, 0, 5), requireBank: true },
    { name: 'Corner Three', desc: 'Make it from the corner', pos: new Vector3(6, 0, 3), requireSwish: false },
    { name: 'Downtown', desc: 'Hit from half court', pos: new Vector3(0, 0, HALF_COURT_DIST), requireSwish: false },
    { name: 'Side Swish', desc: 'Swish from the wing', pos: new Vector3(-4, 0, 5), requireSwish: true },
    { name: 'Off the Glass', desc: 'Bank shot from distance', pos: new Vector3(-2, 0, 7), requireBank: true },
  ];

  // Achievements state
  let achievements: Achievement[] = ACHIEVEMENTS_DEF.map(a => ({
    ...a,
    unlocked: false,
  }));

  // Leaderboard
  let leaderboard: LeaderboardEntry[] = [];

  // Load saved data
  function loadSaveData() {
    try {
      const saved = localStorage.getItem('neon-hoops-data');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.achievements) {
          data.achievements.forEach((id: string) => {
            const a = achievements.find(a => a.id === id);
            if (a) a.unlocked = true;
          });
        }
        if (data.leaderboard) leaderboard = data.leaderboard;
        if (data.totalGames) totalGamesPlayed = data.totalGames;
        if (data.totalMade) totalShotsMadeAll = data.totalMade;
        if (data.theme !== undefined) themeIndex = data.theme;
      }
    } catch {}
  }

  function saveSaveData() {
    try {
      localStorage.setItem('neon-hoops-data', JSON.stringify({
        achievements: achievements.filter(a => a.unlocked).map(a => a.id),
        leaderboard,
        totalGames: totalGamesPlayed,
        totalMade: totalShotsMadeAll,
        theme: themeIndex,
      }));
    } catch {}
  }

  function unlockAchievement(id: string) {
    const a = achievements.find(a => a.id === id);
    if (a && !a.unlocked) {
      a.unlocked = true;
      audio.playAchievement();
      showToast(a.name, 'UNLOCKED!');
      saveSaveData();
    }
  }

  loadSaveData();

  // ============================================================
  // ENVIRONMENT — COURT
  // ============================================================

  function applyTheme() {
    const theme = THEMES[themeIndex];
    // Floor
    courtFloor.material = new MeshStandardMaterial({ color: theme.court, metalness: 0.3, roughness: 0.7 });
    // Lines
    courtLinesMat.color.setHex(theme.lines);
    // Rim
    rimMat.color.setHex(theme.rim);
    rimMat.emissive.setHex(theme.rim);
    // Backboard
    bbMat.color.setHex(theme.backboard);
    bbMat.emissive.setHex(theme.backboard);
    // Fog
    if (world.scene.fog) (world.scene.fog as Fog).color.setHex(theme.fog);
    // Accent lights
    accentLights.forEach(l => l.color.setHex(theme.accent));
    // Grid
    gridMat.color.setHex(theme.lines);
  }

  // Court floor
  const courtFloor = new Mesh(
    new PlaneGeometry(30, 30),
    new MeshStandardMaterial({ color: 0x001122, metalness: 0.3, roughness: 0.7 }),
  );
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.position.y = 0;
  world.scene.add(courtFloor);

  // Grid floor overlay
  const gridMat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.08 });
  for (let i = -15; i <= 15; i++) {
    const lineH = new Mesh(new PlaneGeometry(30, 0.02), gridMat);
    lineH.rotation.x = -Math.PI / 2;
    lineH.position.set(0, 0.005, i);
    world.scene.add(lineH);
    const lineV = new Mesh(new PlaneGeometry(0.02, 30), gridMat);
    lineV.rotation.x = -Math.PI / 2;
    lineV.position.set(i, 0.005, 0);
    world.scene.add(lineV);
  }

  // Ceiling
  const ceiling = new Mesh(
    new PlaneGeometry(30, 30),
    new MeshBasicMaterial({ color: 0x000811, transparent: true, opacity: 0.3 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 8;
  world.scene.add(ceiling);

  // Ceiling grid
  for (let i = -15; i <= 15; i += 2) {
    const lineH = new Mesh(new PlaneGeometry(30, 0.02), new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.04 }));
    lineH.rotation.x = Math.PI / 2;
    lineH.position.set(0, 7.99, i);
    world.scene.add(lineH);
    const lineV = new Mesh(new PlaneGeometry(0.02, 30), new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.04 }));
    lineV.rotation.x = Math.PI / 2;
    lineV.position.set(i, 7.99, 0);
    world.scene.add(lineV);
  }

  // Court lines
  const courtLinesMat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 });

  // Free throw line
  const ftLine = new Mesh(new PlaneGeometry(3.6, 0.05), courtLinesMat);
  ftLine.rotation.x = -Math.PI / 2;
  ftLine.position.set(0, 0.01, FREE_THROW_DIST);
  world.scene.add(ftLine);

  // Three-point arc (simplified as segments)
  for (let angle = -Math.PI / 2; angle <= Math.PI / 2; angle += 0.1) {
    const seg = new Mesh(new PlaneGeometry(0.3, 0.04), courtLinesMat);
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(Math.sin(angle) * THREE_POINT_DIST, 0.01, Math.cos(angle) * THREE_POINT_DIST * 0.95);
    seg.rotation.z = -angle;
    world.scene.add(seg);
  }

  // Key/paint area
  const keyLines = [
    { w: 0.04, h: 5.8, x: -1.8, z: FREE_THROW_DIST / 2 },
    { w: 0.04, h: 5.8, x: 1.8, z: FREE_THROW_DIST / 2 },
    { w: 3.6, h: 0.04, x: 0, z: 0.5 },
  ];
  keyLines.forEach(({ w, h, x, z }) => {
    const m = new Mesh(new PlaneGeometry(w, h), courtLinesMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.01, z);
    world.scene.add(m);
  });

  // Center court circle
  for (let angle = 0; angle < Math.PI * 2; angle += 0.15) {
    const seg = new Mesh(new PlaneGeometry(0.25, 0.04), courtLinesMat);
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(Math.sin(angle) * 1.8, 0.01, HALF_COURT_DIST + Math.cos(angle) * 1.8);
    seg.rotation.z = -angle;
    world.scene.add(seg);
  }

  // Half court line
  const halfLine = new Mesh(new PlaneGeometry(15, 0.05), courtLinesMat);
  halfLine.rotation.x = -Math.PI / 2;
  halfLine.position.set(0, 0.01, HALF_COURT_DIST);
  world.scene.add(halfLine);

  // ============================================================
  // HOOP & BACKBOARD
  // ============================================================

  // Backboard
  const bbMat = new MeshStandardMaterial({
    color: 0x00aaff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.4,
    metalness: 0.8,
    roughness: 0.2,
  });

  const backboard = new Mesh(
    new BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, 0.04),
    bbMat,
  );
  backboard.position.set(0, RIM_HEIGHT + BACKBOARD_HEIGHT / 2 - 0.1, -0.15);
  world.scene.add(backboard);

  // Backboard edges
  const bbEdges = new LineSegments(
    new EdgesGeometry(new BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, 0.04)),
    new LineBasicMaterial({ color: 0x00ccff }),
  );
  bbEdges.position.copy(backboard.position);
  world.scene.add(bbEdges);

  // Backboard inner square
  const innerSquare = new LineSegments(
    new EdgesGeometry(new BoxGeometry(0.6, 0.45, 0.06)),
    new LineBasicMaterial({ color: 0x00ccff }),
  );
  innerSquare.position.set(0, RIM_HEIGHT + 0.15, -0.12);
  world.scene.add(innerSquare);

  // Rim (torus)
  const rimMat = new MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xff4400,
    emissiveIntensity: 0.3,
    metalness: 0.7,
    roughness: 0.3,
  });

  const rim = new Mesh(
    new TorusGeometry(RIM_RADIUS, 0.015, 8, 32),
    rimMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_HEIGHT, 0);
  world.scene.add(rim);

  // Rim support (connecting rim to backboard)
  const rimSupport = new Mesh(
    new CylinderGeometry(0.015, 0.015, 0.2, 6),
    rimMat,
  );
  rimSupport.rotation.x = Math.PI / 2;
  rimSupport.position.set(0, RIM_HEIGHT, -RIM_RADIUS);
  world.scene.add(rimSupport);

  // Net (simplified with wireframe cylinders)
  const netGroup = new Group();
  const netMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, wireframe: true });
  for (let i = 0; i < 4; i++) {
    const ringR = RIM_RADIUS * (1 - i * 0.15);
    const ring = new Mesh(new TorusGeometry(ringR, 0.005, 4, 16), netMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -i * 0.1;
    netGroup.add(ring);
  }
  netGroup.position.set(0, RIM_HEIGHT, 0);
  world.scene.add(netGroup);

  // Pole
  const pole = new Mesh(
    new CylinderGeometry(0.06, 0.08, RIM_HEIGHT + 0.5, 8),
    new MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 }),
  );
  pole.position.set(0, (RIM_HEIGHT + 0.5) / 2, -0.5);
  world.scene.add(pole);

  // ============================================================
  // BASKETBALL
  // ============================================================

  const ballMat = new MeshStandardMaterial({
    color: 0xff6600,
    emissive: 0xff4400,
    emissiveIntensity: 0.2,
    metalness: 0.2,
    roughness: 0.6,
  });

  const ball = new Mesh(new SphereGeometry(BALL_RADIUS, 16, 16), ballMat);
  ball.position.copy(ballPos);
  world.scene.add(ball);

  // Ball glow
  const ballGlow = new Mesh(
    new SphereGeometry(BALL_RADIUS * 1.4, 8, 8),
    new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.15, blending: AdditiveBlending }),
  );
  ball.add(ballGlow);

  // Ball seams (simple lines)
  const seamGeo = new EdgesGeometry(new SphereGeometry(BALL_RADIUS * 1.01, 4, 2));
  const seamLines = new LineSegments(seamGeo, new LineBasicMaterial({ color: 0x331100, transparent: true, opacity: 0.5 }));
  ball.add(seamLines);

  // ============================================================
  // LIGHTING & ENVIRONMENT
  // ============================================================

  world.scene.add(new AmbientLight(0x222244, 0.4));

  const mainLight = new DirectionalLight(0xffffff, 0.6);
  mainLight.position.set(5, 10, 5);
  world.scene.add(mainLight);

  const accentLights: PointLight[] = [];
  const lightPositions = [
    [0, 6, 0], [-5, 5, 5], [5, 5, 5], [0, 5, -3],
  ];
  lightPositions.forEach(([x, y, z]) => {
    const light = new PointLight(0xff6600, 0.5, 20);
    light.position.set(x, y, z);
    world.scene.add(light);
    accentLights.push(light);
  });

  // Hoop spotlight
  const hoopLight = new PointLight(0xff4400, 1.0, 8);
  hoopLight.position.set(0, RIM_HEIGHT + 2, 0);
  world.scene.add(hoopLight);

  world.scene.fog = new Fog(0x000811, 5, 35);

  // Floating wireframe decorations
  const decoShapes: Mesh[] = [];
  const decoGeos = [
    new TorusGeometry(0.4, 0.08, 8, 16),
    new BoxGeometry(0.6, 0.6, 0.6),
    new SphereGeometry(0.35, 6, 6),
    new ConeGeometry(0.3, 0.6, 6),
  ];
  for (let i = 0; i < 12; i++) {
    const geo = decoGeos[i % decoGeos.length];
    const edges = new EdgesGeometry(geo);
    const mat = new LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.15 });
    const wireframe = new LineSegments(edges, mat);
    const angle = (i / 12) * Math.PI * 2;
    const r = 8 + Math.random() * 5;
    wireframe.position.set(Math.cos(angle) * r, 3 + Math.random() * 4, Math.sin(angle) * r);
    world.scene.add(wireframe);
    decoShapes.push(wireframe as any);
  }

  // Ambient floating particles
  const ambientParticles: { mesh: Mesh; baseY: number; phase: number }[] = [];
  const apMat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.3 });
  for (let i = 0; i < 40; i++) {
    const p = new Mesh(new SphereGeometry(0.02, 4, 4), apMat.clone());
    p.position.set(
      (Math.random() - 0.5) * 25,
      Math.random() * 7 + 0.5,
      (Math.random() - 0.5) * 25,
    );
    world.scene.add(p);
    ambientParticles.push({ mesh: p, baseY: p.position.y, phase: Math.random() * Math.PI * 2 });
  }

  // Shot position marker
  const markerMat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.4 });
  const shotMarker = new Mesh(new RingGeometry(0.3, 0.5, 16), markerMat);
  shotMarker.rotation.x = -Math.PI / 2;
  shotMarker.position.set(0, 0.02, FREE_THROW_DIST);
  world.scene.add(shotMarker);

  // ============================================================
  // UI ENTITIES
  // ============================================================

  function setText(doc: UIKitDocument | undefined, id: string, text: string) {
    if (!doc) return;
    const el = doc.getElementById(id);
    if (el && 'text' in el && el.text && 'value' in el.text) {
      (el.text as any).value = text;
    }
  }

  function bindBtn(doc: UIKitDocument | undefined, id: string, cb: () => void) {
    if (!doc) return;
    const el = doc.getElementById(id);
    if (el) el.addEventListener('click', () => { audio.playButtonClick(); cb(); });
  }

  // Title panel
  const titleEntity = world.createTransformEntity(undefined, { persistent: true });
  titleEntity.object3D!.position.set(0, 2.5, -2);
  titleEntity.addComponent(PanelUI, { config: '/ui/title.json', maxWidth: 0.7, maxHeight: 1.0 });

  // Mode select panel
  const modeEntity = world.createTransformEntity(undefined, { persistent: true });
  modeEntity.object3D!.position.set(0, 2.5, -2);
  modeEntity.addComponent(PanelUI, { config: '/ui/modeselect.json', maxWidth: 0.7, maxHeight: 1.2 });

  // Difficulty panel
  const diffEntity = world.createTransformEntity(undefined, { persistent: true });
  diffEntity.object3D!.position.set(0, 2.5, -2);
  diffEntity.addComponent(PanelUI, { config: '/ui/difficulty.json', maxWidth: 0.6, maxHeight: 0.9 });

  // HUD panel (head-following)
  const hudEntity = world.createTransformEntity(undefined, { persistent: true });
  hudEntity.addComponent(PanelUI, { config: '/ui/hud.json', maxWidth: 0.35, maxHeight: 0.1 });
  hudEntity.addComponent(Follower, {
    target: world.player.head,
    offsetPosition: [0, 0.2, -0.5],
    behavior: FollowBehavior.PivotY,
    speed: 5,
    tolerance: 0.3,
  });

  // Toast panel (head-following)
  const toastEntity = world.createTransformEntity(undefined, { persistent: true });
  toastEntity.addComponent(PanelUI, { config: '/ui/toast.json', maxWidth: 0.3, maxHeight: 0.1 });
  toastEntity.addComponent(Follower, {
    target: world.player.head,
    offsetPosition: [0, 0, -0.6],
    behavior: FollowBehavior.PivotY,
    speed: 5,
    tolerance: 0.3,
  });

  // Power bar (head-following)
  const powerEntity = world.createTransformEntity(undefined, { persistent: true });
  powerEntity.addComponent(PanelUI, { config: '/ui/powerbar.json', maxWidth: 0.15, maxHeight: 0.08 });
  powerEntity.addComponent(Follower, {
    target: world.player.head,
    offsetPosition: [-0.25, -0.15, -0.5],
    behavior: FollowBehavior.PivotY,
    speed: 5,
    tolerance: 0.3,
  });

  // Countdown panel (head-following)
  const countdownEntity = world.createTransformEntity(undefined, { persistent: true });
  countdownEntity.addComponent(PanelUI, { config: '/ui/countdown.json', maxWidth: 0.25, maxHeight: 0.2 });
  countdownEntity.addComponent(Follower, {
    target: world.player.head,
    offsetPosition: [0, 0.05, -0.5],
    behavior: FollowBehavior.PivotY,
    speed: 5,
    tolerance: 0.3,
  });

  // Pause panel
  const pauseEntity = world.createTransformEntity(undefined, { persistent: true });
  pauseEntity.object3D!.position.set(0, 2.5, -2);
  pauseEntity.addComponent(PanelUI, { config: '/ui/pause.json', maxWidth: 0.5, maxHeight: 0.6 });

  // Game over panel
  const goEntity = world.createTransformEntity(undefined, { persistent: true });
  goEntity.object3D!.position.set(0, 2.5, -2);
  goEntity.addComponent(PanelUI, { config: '/ui/gameover.json', maxWidth: 0.6, maxHeight: 0.8 });

  // Leaderboard panel
  const lbEntity = world.createTransformEntity(undefined, { persistent: true });
  lbEntity.object3D!.position.set(0, 2.5, -2);
  lbEntity.addComponent(PanelUI, { config: '/ui/leaderboard.json', maxWidth: 0.7, maxHeight: 1.0 });

  // Achievements panel
  const achEntity = world.createTransformEntity(undefined, { persistent: true });
  achEntity.object3D!.position.set(0, 2.5, -2);
  achEntity.addComponent(PanelUI, { config: '/ui/achievements.json', maxWidth: 0.7, maxHeight: 1.2 });

  // Settings panel
  const settingsEntity = world.createTransformEntity(undefined, { persistent: true });
  settingsEntity.object3D!.position.set(0, 2.5, -2);
  settingsEntity.addComponent(PanelUI, { config: '/ui/settings.json', maxWidth: 0.6, maxHeight: 0.9 });

  // Help panel
  const helpEntity = world.createTransformEntity(undefined, { persistent: true });
  helpEntity.object3D!.position.set(0, 2.5, -2);
  helpEntity.addComponent(PanelUI, { config: '/ui/help.json', maxWidth: 0.6, maxHeight: 1.0 });

  // Panel visibility
  const allPanelEntities = [
    titleEntity, modeEntity, diffEntity, hudEntity, toastEntity, powerEntity,
    countdownEntity, pauseEntity, goEntity, lbEntity, achEntity, settingsEntity, helpEntity,
  ];

  let toastTimer = 0;

  function showToast(text: string, sub: string) {
    const doc = toastEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(doc, 'toast-text', text);
    setText(doc, 'toast-sub', sub);
    toastEntity.object3D!.visible = true;
    toastTimer = 2.0;
  }

  function hideAllPanels() {
    allPanelEntities.forEach(e => { if (e.object3D) e.object3D.visible = false; });
  }

  function showPanel(entity: any) {
    hideAllPanels();
    if (entity.object3D) entity.object3D.visible = true;
  }

  // ============================================================
  // UI BINDING (deferred until docs ready)
  // ============================================================

  let uiBound = false;

  function tryBindUI() {
    const titleDoc = titleEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    if (!titleDoc) return;
    uiBound = true;

    // Title
    bindBtn(titleDoc, 'btn-play', () => startGame('freethrow'));
    bindBtn(titleDoc, 'btn-modes', () => { gameState = 'modeselect'; showPanel(modeEntity); });
    bindBtn(titleDoc, 'btn-leaderboard', () => { gameState = 'leaderboard'; updateLeaderboardUI(); showPanel(lbEntity); });
    bindBtn(titleDoc, 'btn-achievements', () => { gameState = 'achievements'; updateAchievementsUI(); showPanel(achEntity); });
    bindBtn(titleDoc, 'btn-settings', () => { gameState = 'settings'; updateSettingsUI(); showPanel(settingsEntity); });
    bindBtn(titleDoc, 'btn-help', () => { gameState = 'help'; showPanel(helpEntity); });

    // Mode select
    const modeDoc = modeEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(modeDoc, 'btn-freethrow', () => startGame('freethrow'));
    bindBtn(modeDoc, 'btn-threepoint', () => startGame('threepoint'));
    bindBtn(modeDoc, 'btn-arcade', () => startGame('arcade'));
    bindBtn(modeDoc, 'btn-horse', () => { gameMode = 'horse'; gameState = 'difficulty'; showPanel(diffEntity); });
    bindBtn(modeDoc, 'btn-trickshot', () => startGame('trickshot'));
    bindBtn(modeDoc, 'btn-practice', () => startGame('practice'));
    bindBtn(modeDoc, 'btn-modes-back', () => { gameState = 'title'; showPanel(titleEntity); });

    // Difficulty
    const diffDoc = diffEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(diffDoc, 'btn-easy', () => startGame('horse'));
    bindBtn(diffDoc, 'btn-medium', () => startGame('horse'));
    bindBtn(diffDoc, 'btn-hard', () => startGame('horse'));
    bindBtn(diffDoc, 'btn-diff-back', () => { gameState = 'modeselect'; showPanel(modeEntity); });

    // Pause
    const pauseDoc = pauseEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(pauseDoc, 'btn-resume', () => resumeGame());
    bindBtn(pauseDoc, 'btn-quit', () => quitToMenu());

    // Game over
    const goDoc = goEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(goDoc, 'btn-replay', () => startGame(gameMode));
    bindBtn(goDoc, 'btn-menu', () => quitToMenu());

    // Leaderboard
    const lbDoc = lbEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(lbDoc, 'btn-lb-back', () => { gameState = 'title'; showPanel(titleEntity); });

    // Achievements
    const achDoc = achEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(achDoc, 'btn-ach-back', () => { gameState = 'title'; showPanel(titleEntity); });

    // Settings
    const settingsDoc = settingsEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(settingsDoc, 'btn-master-up', () => { audio.masterVol = Math.min(1, audio.masterVol + 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-master-down', () => { audio.masterVol = Math.max(0, audio.masterVol - 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-sfx-up', () => { audio.sfxVol = Math.min(1, audio.sfxVol + 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-sfx-down', () => { audio.sfxVol = Math.max(0, audio.sfxVol - 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-music-up', () => { audio.musicVol = Math.min(1, audio.musicVol + 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-music-down', () => { audio.musicVol = Math.max(0, audio.musicVol - 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-theme-prev', () => { themeIndex = (themeIndex - 1 + THEMES.length) % THEMES.length; applyTheme(); updateSettingsUI(); saveSaveData(); });
    bindBtn(settingsDoc, 'btn-theme-next', () => { themeIndex = (themeIndex + 1) % THEMES.length; applyTheme(); updateSettingsUI(); saveSaveData(); });
    bindBtn(settingsDoc, 'btn-settings-back', () => { gameState = 'title'; showPanel(titleEntity); });

    // Help
    const helpDoc = helpEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(helpDoc, 'btn-help-back', () => { gameState = 'title'; showPanel(titleEntity); });

    // Initial state
    showPanel(titleEntity);
    audio.startAmbient();
    applyTheme();
  }

  // ============================================================
  // GAME LOGIC
  // ============================================================

  function startGame(mode: GameMode) {
    gameMode = mode;
    score = 0;
    shotsMade = 0;
    shotsTaken = 0;
    streak = 0;
    bestStreak = 0;
    swishCount = 0;
    bankShotCount = 0;
    arcadeLevel = 1;
    arcadeTimeLeft = 30;
    horseLetters = ['', ''];
    horseCurrentShooter = 0;
    horseChallengeShot = null;
    trickShotIndex = 0;
    threePointRack = 0;
    threePointBallInRack = 0;
    threePointScore = 0;
    threePointTimeLeft = 60;

    // Set shot position
    resetBallToShotPosition();

    // Start countdown
    gameState = 'countdown';
    countdownValue = 3;
    countdownTimer = 0;
    showPanel(countdownEntity);
    audio.playCountdownTick();
  }

  function getShotPosition(): Vector3 {
    switch (gameMode) {
      case 'freethrow':
        return shotPositions.freethrow.clone();
      case 'threepoint':
        return shotPositions.threepoint[threePointRack]?.clone() ?? shotPositions.threepoint[0].clone();
      case 'arcade':
        // Random positions that get farther
        const dist = FREE_THROW_DIST + (arcadeLevel - 1) * 0.5;
        const angle = (Math.random() - 0.5) * 1.0;
        return new Vector3(Math.sin(angle) * dist * 0.3, 0, dist);
      case 'horse':
        // Random spots
        const hd = FREE_THROW_DIST + Math.random() * 4;
        const ha = (Math.random() - 0.5) * 1.5;
        return new Vector3(Math.sin(ha) * hd * 0.4, 0, hd);
      case 'trickshot':
        return trickShots[trickShotIndex]?.pos.clone() ?? shotPositions.freethrow.clone();
      case 'practice':
        return shotPositions.freethrow.clone();
      default:
        return shotPositions.freethrow.clone();
    }
  }

  function resetBallToShotPosition() {
    const pos = getShotPosition();
    ballPos.set(pos.x, 1.2, pos.z);
    ballVel.set(0, 0, 0);
    ball.position.copy(ballPos);
    ballInFlight = false;
    ballSettled = false;
    shotProcessed = false;
    settleTimer = 0;
    ballBounceCount = 0;
    trailPoints.length = 0;

    // Update marker
    shotMarker.position.set(pos.x, 0.02, pos.z);
    shotMarker.visible = true;
  }

  function getTotalShots(): number {
    switch (gameMode) {
      case 'freethrow': return 10;
      case 'threepoint': return 25;
      case 'arcade': return 999;
      case 'horse': return 999;
      case 'trickshot': return trickShots.length;
      case 'practice': return 999;
      default: return 10;
    }
  }

  function isGameOver(): boolean {
    switch (gameMode) {
      case 'freethrow': return shotsTaken >= 10;
      case 'threepoint': return threePointRack >= 5;
      case 'arcade': return arcadeTimeLeft <= 0;
      case 'horse': return horseLetters[0].length >= 5 || horseLetters[1].length >= 5;
      case 'trickshot': return trickShotIndex >= trickShots.length;
      case 'practice': return false;
      default: return false;
    }
  }

  function shootBall(power: number, aimAngle: number) {
    if (ballInFlight) return;

    ballInFlight = true;
    shotProcessed = false;
    settleTimer = 0;
    ballBounceCount = 0;

    // Calculate direction toward hoop
    const toHoop = new Vector3(0, RIM_HEIGHT, 0).sub(ballPos);
    const dist = Math.sqrt(toHoop.x * toHoop.x + toHoop.z * toHoop.z);

    // Arc angle (higher power = flatter arc)
    const arcAngle = 0.8 + (1 - power) * 0.4;
    const speed = 5 + power * 7 + dist * 0.5;

    // Horizontal direction
    const horizDir = new Vector3(toHoop.x, 0, toHoop.z).normalize();

    // Add aim offset
    horizDir.x += aimAngle * 0.3;
    horizDir.normalize();

    ballVel.set(
      horizDir.x * speed * Math.cos(arcAngle),
      speed * Math.sin(arcAngle),
      horizDir.z * speed * Math.cos(arcAngle),
    );

    shotsTaken++;
    audio.playThrow();

    // Update HUD
    updateHUD();
  }

  function processShotResult(): ShotResult {
    // Check if ball went through the hoop
    const dx = ballPos.x;
    const dz = ballPos.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    const distFromShot = Math.sqrt(
      Math.pow(getShotPosition().x, 2) + Math.pow(getShotPosition().z, 2),
    );

    // Simple check: ball is near rim height and within rim radius
    const nearRim = Math.abs(ballPos.y - RIM_HEIGHT) < 0.3 && horizDist < RIM_RADIUS;
    const isSwish = nearRim && horizDist < RIM_RADIUS * 0.5;
    const isBankShot = ballBounceCount > 0 && nearRim; // Hit backboard first

    const made = nearRim;
    let points = 0;

    if (made) {
      if (isSwish) {
        points = 3;
        swishCount++;
      } else if (isBankShot) {
        points = 2;
        bankShotCount++;
      } else {
        points = 2;
      }

      // Distance bonus
      if (distFromShot >= THREE_POINT_DIST) points += 1;
      if (distFromShot >= HALF_COURT_DIST * 0.8) points += 2;

      // Streak bonus
      streak++;
      if (streak >= 3) points += streak - 2;
      if (streak > bestStreak) bestStreak = streak;

      shotsMade++;
      totalShotsMadeAll++;
      score += points;
    } else {
      streak = 0;
    }

    return { made, swish: isSwish, bankShot: isBankShot, points, distance: distFromShot };
  }

  function handleShotComplete(result: ShotResult) {
    if (result.made) {
      if (result.swish) {
        audio.playSwish();
        showToast('SWISH!', `+${result.points}`);
        spawnParticles(ball.position.clone(), 15, 0xff6600);
      } else if (result.bankShot) {
        audio.playMake();
        showToast('BANK SHOT!', `+${result.points}`);
        spawnParticles(ball.position.clone(), 10, 0x00aaff);
      } else {
        audio.playMake();
        showToast('GOOD!', `+${result.points}`);
        spawnParticles(ball.position.clone(), 8, 0x00ff88);
      }

      if (streak >= 3) {
        const msgs = ['HOT!', 'ON FIRE!', 'UNSTOPPABLE!', 'LEGENDARY!'];
        const idx = Math.min(streak - 3, msgs.length - 1);
        setTimeout(() => showToast(msgs[idx], `${streak} in a row!`), 800);
      }

      // Achievement checks
      unlockAchievement('first_basket');
      if (streak >= 5) unlockAchievement('sharpshooter');
      if (streak >= 10) unlockAchievement('on_fire');
      if (score >= 100) unlockAchievement('century');
      if (swishCount >= 5) unlockAchievement('swish_master');
      if (bankShotCount >= 3) unlockAchievement('bank_artist');
      if (result.distance >= HALF_COURT_DIST * 0.8) unlockAchievement('long_range');
      if (result.distance >= THREE_POINT_DIST) unlockAchievement('downtown');
      if (totalShotsMadeAll >= 100) unlockAchievement('total_100');
      if (totalShotsMadeAll >= 500) unlockAchievement('total_500');
    } else {
      audio.playMiss();
      showToast('MISS', '');
    }

    // Mode-specific handling
    handleModeLogic(result);

    updateHUD();
    saveSaveData();

    // Check game over
    if (isGameOver()) {
      setTimeout(() => endGame(), 1500);
    } else {
      // Reset ball for next shot
      setTimeout(() => resetBallToShotPosition(), 1500);
    }
  }

  function handleModeLogic(result: ShotResult) {
    switch (gameMode) {
      case 'freethrow':
        if (shotsTaken >= 10 && shotsMade >= 10) unlockAchievement('perfect_10');
        if (shotsTaken >= 10 && shotsMade / shotsTaken >= 0.8) unlockAchievement('marksman');
        break;
      case 'threepoint':
        threePointBallInRack++;
        if (result.made) threePointScore++;
        if (threePointBallInRack >= 5) {
          threePointBallInRack = 0;
          threePointRack++;
        }
        if (threePointScore >= 20) unlockAchievement('three_pt_20');
        break;
      case 'arcade':
        if (result.made) arcadeLevel++;
        break;
      case 'horse':
        if (horseCurrentShooter === 0) {
          horseChallengeShot = result.made ? { pos: getShotPosition(), result } : null;
          horseCurrentShooter = 1;
          // AI turn
          setTimeout(() => {
            if (horseChallengeShot) {
              // AI must match
              const aiMakes = Math.random() < 0.5;
              if (!aiMakes) {
                horseLetters[1] += 'HORSE'[horseLetters[1].length];
                showToast('AI MISSES!', `AI: ${horseLetters[1]}`);
              } else {
                showToast('AI MAKES IT!', 'Your turn');
              }
            } else {
              // AI sets challenge
              const aiMakes = Math.random() < 0.6;
              if (aiMakes) {
                showToast('AI MAKES IT!', 'Match this shot!');
                horseChallengeShot = { pos: getShotPosition(), result: { made: true, swish: false, bankShot: false, points: 2, distance: 5 } };
              } else {
                showToast('AI MISSES', 'Your shot!');
              }
            }
            horseCurrentShooter = 0;
            horseChallengeShot = null;
          }, 1000);
        } else {
          if (horseChallengeShot && !result.made) {
            horseLetters[0] += 'HORSE'[horseLetters[0].length];
            showToast('MISS!', `You: ${horseLetters[0]}`);
          }
          horseCurrentShooter = 0;
          horseChallengeShot = null;
        }
        if (horseLetters[1].length >= 5) unlockAchievement('horse_winner');
        if (horseLetters[1].length >= 5 && horseLetters[0].length === 0) unlockAchievement('no_miss');
        break;
      case 'trickshot':
        const trick = trickShots[trickShotIndex];
        if (trick) {
          if (result.made) {
            if (trick.requireSwish && !result.swish) {
              showToast('NEED SWISH!', 'Try again');
              return;
            }
            if (trick.requireBank && !result.bankShot) {
              showToast('NEED BANK!', 'Off the glass!');
              return;
            }
            trickShotIndex++;
            if (trickShotIndex >= trickShots.length) unlockAchievement('trick_master');
          }
        }
        break;
    }
  }

  function endGame() {
    gameState = 'gameover';
    audio.playGameOver();

    totalGamesPlayed++;
    if (totalGamesPlayed >= 10) unlockAchievement('games_10');
    if (totalGamesPlayed >= 50) unlockAchievement('games_50');
    if (gameMode === 'arcade' && score >= 50) unlockAchievement('arcade_50');
    if (gameMode === 'arcade' && score >= 100) unlockAchievement('arcade_100');

    // Add to leaderboard
    const accuracy = shotsTaken > 0 ? Math.round((shotsMade / shotsTaken) * 100) : 0;
    leaderboard.push({
      score,
      mode: gameMode,
      accuracy,
      date: new Date().toLocaleDateString(),
    });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 20);
    saveSaveData();

    // Update game over UI
    const goDoc = goEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(goDoc, 'go-score', `${score}`);
    setText(goDoc, 'go-made', `${shotsMade}/${shotsTaken}`);
    setText(goDoc, 'go-accuracy', `${accuracy}%`);
    setText(goDoc, 'go-streak', `${bestStreak}`);

    if (gameMode === 'horse') {
      const won = horseLetters[1].length >= 5;
      setText(goDoc, 'go-title', won ? 'YOU WIN!' : 'YOU LOSE');
      setText(goDoc, 'go-subtitle', `You: ${horseLetters[0] || '-'}  AI: ${horseLetters[1] || '-'}`);
    } else {
      setText(goDoc, 'go-title', 'GAME OVER');
      setText(goDoc, 'go-subtitle', score >= 50 ? 'Great game!' : 'Nice shooting!');
    }

    showPanel(goEntity);
    ball.visible = false;
    ballGlow.visible = false;
  }

  function resumeGame() {
    gameState = 'playing';
    paused = false;
    hideAllPanels();
    hudEntity.object3D!.visible = true;
    if (isCharging) powerEntity.object3D!.visible = true;
  }

  function quitToMenu() {
    gameState = 'title';
    paused = false;
    ballInFlight = false;
    ball.visible = true;
    ballGlow.visible = true;
    audio.stopAmbient();
    audio.startAmbient();
    showPanel(titleEntity);
  }

  function updateHUD() {
    const doc = hudEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(doc, 'hud-score', `${score}`);
    setText(doc, 'hud-shots', `${shotsMade}/${shotsTaken}`);
    setText(doc, 'hud-streak', streak > 0 ? `${streak}` : '0');
    const modeNames: Record<GameMode, string> = {
      freethrow: 'FREE THROW',
      threepoint: '3-PT CONTEST',
      arcade: 'ARCADE',
      horse: 'H.O.R.S.E.',
      trickshot: 'TRICK SHOTS',
      practice: 'PRACTICE',
    };
    setText(doc, 'hud-mode', modeNames[gameMode] || gameMode.toUpperCase());

    // Info line
    let info = '';
    switch (gameMode) {
      case 'freethrow': info = `${10 - shotsTaken} left`; break;
      case 'threepoint': info = `Rack ${threePointRack + 1}/5`; break;
      case 'arcade': info = `Lvl ${arcadeLevel} - ${Math.ceil(arcadeTimeLeft)}s`; break;
      case 'horse': info = `You: ${horseLetters[0] || '-'}  AI: ${horseLetters[1] || '-'}`; break;
      case 'trickshot': info = trickShots[trickShotIndex]?.name ?? 'Done'; break;
      case 'practice': info = 'No pressure'; break;
    }
    setText(doc, 'hud-info', info);
  }

  function updatePowerBar(power: number) {
    const doc = powerEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    const filled = Math.round(power * 10);
    const bar = '|'.repeat(filled) + '-'.repeat(10 - filled);
    setText(doc, 'power-bar', bar);
    setText(doc, 'power-pct', `${Math.round(power * 100)}%`);
  }

  function updateLeaderboardUI() {
    const doc = lbEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    for (let i = 0; i < 10; i++) {
      const entry = leaderboard[i];
      setText(doc, `lb-s${i}`, entry ? `${entry.score}` : '--');
      setText(doc, `lb-m${i}`, entry ? entry.mode.toUpperCase() : '--');
      setText(doc, `lb-d${i}`, entry ? entry.date : '--');
    }
  }

  function updateAchievementsUI() {
    const doc = achEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    const unlocked = achievements.filter(a => a.unlocked).length;
    setText(doc, 'ach-count', `${unlocked} / ${achievements.length} Unlocked`);
    for (let i = 0; i < 12; i++) {
      const a = achievements[i];
      if (a) {
        setText(doc, `ach-n${i}`, a.name);
        setText(doc, `ach-d${i}`, a.desc);
        setText(doc, `ach-s${i}`, a.unlocked ? 'YES' : '--');
      }
    }
  }

  function updateSettingsUI() {
    const doc = settingsEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(doc, 'vol-master', `${Math.round(audio.masterVol * 100)}%`);
    setText(doc, 'vol-sfx', `${Math.round(audio.sfxVol * 100)}%`);
    setText(doc, 'vol-music', `${Math.round(audio.musicVol * 100)}%`);
    setText(doc, 'theme-name', THEMES[themeIndex].name);
  }

  // ============================================================
  // PARTICLES
  // ============================================================

  function spawnParticles(pos: Vector3, count: number, color: number) {
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const mesh = new Mesh(
        new SphereGeometry(0.02, 4, 4),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
      );
      mesh.position.copy(pos);
      world.scene.add(mesh);
      particles.push({
        mesh,
        vel: new Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 4 + 1,
          (Math.random() - 0.5) * 3,
        ),
        life: 0,
        maxLife: 0.8 + Math.random() * 0.5,
      });
    }
  }

  // ============================================================
  // BALL PHYSICS
  // ============================================================

  function updateBallPhysics(dt: number) {
    if (!ballInFlight) return;

    const substeps = 4;
    const subDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      // Gravity
      ballVel.y += GRAVITY * subDt;

      // Position update
      ballPos.x += ballVel.x * subDt;
      ballPos.y += ballVel.y * subDt;
      ballPos.z += ballVel.z * subDt;

      // Floor bounce
      if (ballPos.y < BALL_RADIUS) {
        ballPos.y = BALL_RADIUS;
        ballVel.y *= -0.6;
        ballVel.x *= 0.8;
        ballVel.z *= 0.8;
        if (Math.abs(ballVel.y) > 0.3) {
          audio.playBounceFloor();
        }
      }

      // Backboard collision
      if (ballPos.z < -0.13 && ballPos.z > -0.2 &&
          Math.abs(ballPos.x) < BACKBOARD_WIDTH / 2 &&
          ballPos.y > RIM_HEIGHT - 0.1 && ballPos.y < RIM_HEIGHT + BACKBOARD_HEIGHT) {
        ballPos.z = -0.13;
        ballVel.z *= -0.65;
        ballBounceCount++;
        audio.playBackboardHit();
        spawnParticles(ballPos.clone(), 5, 0x00aaff);
      }

      // Rim collision (simplified cylinder)
      const dx = ballPos.x;
      const dz = ballPos.z;
      const rimDist = Math.sqrt(dx * dx + dz * dz);
      const rimDiff = Math.abs(rimDist - RIM_RADIUS);

      if (rimDiff < BALL_RADIUS + 0.02 && Math.abs(ballPos.y - RIM_HEIGHT) < BALL_RADIUS + 0.05) {
        // Bounce off rim
        const nx = dx / (rimDist || 1);
        const nz = dz / (rimDist || 1);
        const dot = ballVel.x * nx + ballVel.z * nz;
        ballVel.x -= 1.5 * dot * nx;
        ballVel.z -= 1.5 * dot * nz;
        ballVel.y *= 0.7;

        // Push out of rim
        if (rimDist < RIM_RADIUS) {
          ballPos.x = nx * (RIM_RADIUS - BALL_RADIUS - 0.03);
          ballPos.z = nz * (RIM_RADIUS - BALL_RADIUS - 0.03);
        } else {
          ballPos.x = nx * (RIM_RADIUS + BALL_RADIUS + 0.03);
          ballPos.z = nz * (RIM_RADIUS + BALL_RADIUS + 0.03);
        }

        ballBounceCount++;
        audio.playRimHit();
        spawnParticles(ballPos.clone(), 3, 0xff4400);
      }

      // Check if ball passes through hoop
      if (!shotProcessed && ballPos.y < RIM_HEIGHT && ballPos.y > RIM_HEIGHT - 0.5) {
        const passThrough = Math.sqrt(ballPos.x * ballPos.x + ballPos.z * ballPos.z) < RIM_RADIUS - BALL_RADIUS * 0.5;
        if (passThrough && ballVel.y < 0) {
          shotProcessed = true;
          const result = processShotResult();
          result.made = true;
          result.swish = ballBounceCount === 0;
          if (result.swish) swishCount++;
          result.bankShot = ballBounceCount > 0;
          if (result.bankShot) bankShotCount++;
          let pts = result.swish ? 3 : 2;
          const distFromShot = getShotPosition().length();
          if (distFromShot >= THREE_POINT_DIST) pts += 1;
          if (distFromShot >= HALF_COURT_DIST * 0.8) pts += 2;
          streak++;
          if (streak >= 3) pts += streak - 2;
          if (streak > bestStreak) bestStreak = streak;
          shotsMade++;
          totalShotsMadeAll++;
          score += pts;
          result.points = pts;
          handleShotComplete(result);
          return;
        }
      }
    }

    // Ball rotation
    const speed = ballVel.length();
    if (speed > 0.1) {
      ball.rotation.x += ballVel.z * dt * 3;
      ball.rotation.z -= ballVel.x * dt * 3;
    }

    ball.position.copy(ballPos);

    // Ball trail
    if (speed > 1) {
      trailPoints.push({ pos: ballPos.clone(), age: 0 });
      if (trailPoints.length > 30) trailPoints.shift();
    }

    // Check if ball has settled (missed shot)
    if (ballPos.y < BALL_RADIUS + 0.1 && speed < 0.3) {
      settleTimer += dt;
      if (settleTimer > 1.0 && !shotProcessed) {
        shotProcessed = true;
        streak = 0;
        handleShotComplete({ made: false, swish: false, bankShot: false, points: 0, distance: 0 });
      }
    }

    // Out of bounds reset
    if (ballPos.y < -2 || Math.abs(ballPos.x) > 15 || Math.abs(ballPos.z) > 20) {
      if (!shotProcessed) {
        shotProcessed = true;
        streak = 0;
        handleShotComplete({ made: false, swish: false, bankShot: false, points: 0, distance: 0 });
      }
    }
  }

  // ============================================================
  // INPUT — BROWSER
  // ============================================================

  const raycaster = new Raycaster();
  const mouse = new Vector2();

  container.addEventListener('mousedown', (e) => {
    if (gameState !== 'playing' || ballInFlight) return;
    isCharging = true;
    chargeStart = performance.now();
    chargePower = 0;
    aimX = 0;
    mouseY = e.clientY;
    powerEntity.object3D!.visible = true;
  });

  container.addEventListener('mousemove', (e) => {
    if (!isCharging) return;
    aimX = (e.clientX / window.innerWidth - 0.5) * 2;
    const dy = mouseY - e.clientY;
    chargePower = Math.min(1, Math.max(0, dy / 200));
    updatePowerBar(chargePower);
  });

  container.addEventListener('mouseup', () => {
    if (!isCharging) return;
    isCharging = false;
    powerEntity.object3D!.visible = false;
    if (gameState === 'playing' && !ballInFlight && chargePower > 0.05) {
      shootBall(chargePower, aimX);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (gameState === 'playing') {
        gameState = 'paused';
        paused = true;
        showPanel(pauseEntity);
      } else if (gameState === 'paused') {
        resumeGame();
      }
    }
  });

  // ============================================================
  // INPUT — XR CONTROLLERS
  // ============================================================

  let xrCharging = false;
  let xrChargeStart = 0;

  // ============================================================
  // MAIN LOOP
  // ============================================================

  let lastTime = performance.now();
  let elapsedTime = 0;

  function update() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    elapsedTime += dt;

    // Bind UI once docs are ready
    if (!uiBound) tryBindUI();

    // Countdown
    if (gameState === 'countdown') {
      countdownTimer += dt;
      if (countdownTimer >= 1) {
        countdownTimer = 0;
        countdownValue--;
        const cdDoc = countdownEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
        if (countdownValue > 0) {
          setText(cdDoc, 'cd-num', `${countdownValue}`);
          audio.playCountdownTick();
        } else {
          setText(cdDoc, 'cd-num', 'GO!');
          setText(cdDoc, 'cd-label', '');
          audio.playGameStart();
          setTimeout(() => {
            gameState = 'playing';
            hideAllPanels();
            hudEntity.object3D!.visible = true;
            ball.visible = true;
            ballGlow.visible = true;
            updateHUD();
          }, 500);
        }
      }
    }

    // Toast timer
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) {
        toastEntity.object3D!.visible = false;
      }
    }

    // Game logic
    if (gameState === 'playing' && !paused) {
      // Ball physics
      updateBallPhysics(dt);

      // Arcade timer
      if (gameMode === 'arcade' && !ballInFlight) {
        arcadeTimeLeft -= dt;
        if (arcadeTimeLeft <= 0) {
          arcadeTimeLeft = 0;
          endGame();
        }
        updateHUD();
      }

      // Three-point timer
      if (gameMode === 'threepoint') {
        threePointTimeLeft -= dt;
        if (threePointTimeLeft <= 0) {
          threePointRack = 5;
          endGame();
        }
      }

      // XR input
      const rightGamepad = (world.input as any).xr?.gamepads?.right;
      if (rightGamepad) {
        // Trigger to shoot
        const triggerDown = rightGamepad.getButtonDown?.(InputComponent.Trigger);
        const triggerPressed = rightGamepad.getButtonPressed?.(InputComponent.Trigger);
        const triggerUp = rightGamepad.getButtonUp?.(InputComponent.Trigger);

        if (triggerDown && !ballInFlight) {
          xrCharging = true;
          xrChargeStart = now;
          powerEntity.object3D!.visible = true;
        }

        if (xrCharging && triggerPressed) {
          const elapsed = (now - xrChargeStart) / 1000;
          chargePower = Math.min(1, elapsed / 1.5);
          updatePowerBar(chargePower);
        }

        if (triggerUp && xrCharging) {
          xrCharging = false;
          powerEntity.object3D!.visible = false;
          if (chargePower > 0.05) {
            shootBall(chargePower, 0);
          }
        }

        // B to pause
        if (rightGamepad.getButtonDown?.(InputComponent.B_Button)) {
          if (gameState === 'playing') {
            gameState = 'paused';
            paused = true;
            showPanel(pauseEntity);
          }
        }
      }
    }

    // Animate particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      p.vel.y += GRAVITY * 0.5 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha * 0.8;
      p.mesh.scale.setScalar(alpha);
      if (p.life >= p.maxLife) {
        world.scene.remove(p.mesh);
        particles.splice(i, 1);
      }
    }

    // Animate trail
    for (let i = trailPoints.length - 1; i >= 0; i--) {
      trailPoints[i].age += dt;
      if (trailPoints[i].age > 0.5) trailPoints.splice(i, 1);
    }

    // Animate decorations
    decoShapes.forEach((d, i) => {
      d.rotation.x += dt * 0.2 * (i % 2 === 0 ? 1 : -1);
      d.rotation.y += dt * 0.3;
      d.position.y += Math.sin(elapsedTime * 0.5 + i) * dt * 0.1;
    });

    // Animate ambient particles
    ambientParticles.forEach(p => {
      p.mesh.position.y = p.baseY + Math.sin(elapsedTime + p.phase) * 0.2;
      (p.mesh.material as MeshBasicMaterial).opacity = 0.2 + Math.sin(elapsedTime * 2 + p.phase) * 0.1;
    });

    // Animate rim glow
    rimMat.emissiveIntensity = 0.3 + Math.sin(elapsedTime * 2) * 0.1;

    // Animate shot marker
    shotMarker.scale.setScalar(1 + Math.sin(elapsedTime * 3) * 0.1);
    (shotMarker.material as MeshBasicMaterial).opacity = 0.3 + Math.sin(elapsedTime * 2) * 0.1;

    requestAnimationFrame(update);
  }

  update();
}

main().catch(console.error);
