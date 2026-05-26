// ============================================================
// TYPES, INTERFACES & CONFIG
// ============================================================

import { Vector3 } from '@iwsdk/core';

export type GameState = 'title' | 'modeselect' | 'difficulty' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'leaderboard' | 'achievements' | 'settings' | 'help' | 'dailychallenge';
export type GameMode = 'freethrow' | 'threepoint' | 'arcade' | 'horse' | 'trickshot' | 'practice' | 'daily';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ShotResult {
  made: boolean;
  swish: boolean;
  bankShot: boolean;
  points: number;
  distance: number;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

export interface LeaderboardEntry {
  score: number;
  mode: string;
  accuracy: number;
  date: string;
}

export interface CourtTheme {
  name: string;
  court: number;
  lines: number;
  rim: number;
  backboard: number;
  accent: number;
  fog: number;
}

export interface Particle {
  mesh: import('@iwsdk/core').Mesh;
  vel: Vector3;
  life: number;
  maxLife: number;
}

export interface TrailPoint {
  pos: Vector3;
  age: number;
}

export interface TrickShot {
  name: string;
  desc: string;
  pos: Vector3;
  requireSwish: boolean;
  requireBank?: boolean;
}

export interface DailyChallenge {
  seed: number;
  shots: { pos: Vector3; label: string }[];
  date: string;
  bestScore: number;
}

// ============================================================
// CONSTANTS
// ============================================================

export const GRAVITY = -9.81;
export const BALL_RADIUS = 0.12;
export const RIM_RADIUS = 0.225;
export const RIM_HEIGHT = 3.05;
export const BACKBOARD_WIDTH = 1.8;
export const BACKBOARD_HEIGHT = 1.05;
export const FREE_THROW_DIST = 4.6;
export const THREE_POINT_DIST = 7.24;
export const HALF_COURT_DIST = 14.0;
export const MAX_PARTICLES = 80;

// ============================================================
// THEME DEFINITIONS
// ============================================================

export const THEMES: CourtTheme[] = [
  { name: 'Neon Arena', court: 0x001122, lines: 0xff6600, rim: 0xff4400, backboard: 0x00aaff, accent: 0xff6600, fog: 0x000811 },
  { name: 'Cyberpunk', court: 0x110022, lines: 0xff00ff, rim: 0xff0088, backboard: 0x8800ff, accent: 0xff00ff, fog: 0x080011 },
  { name: 'Arctic Court', court: 0x001133, lines: 0x00ccff, rim: 0x0088ff, backboard: 0x44ddff, accent: 0x00ccff, fog: 0x000a1a },
  { name: 'Solar Blaze', court: 0x221100, lines: 0xffaa00, rim: 0xff6600, backboard: 0xffcc00, accent: 0xffaa00, fog: 0x110800 },
  { name: 'Toxic Green', court: 0x002211, lines: 0x00ff66, rim: 0x00cc44, backboard: 0x44ff88, accent: 0x00ff66, fog: 0x001108 },
];

// ============================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================

export const ACHIEVEMENTS_DEF: { id: string; name: string; desc: string }[] = [
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

// ============================================================
// SHOT POSITIONS & TRICK SHOTS
// ============================================================

export const SHOT_POSITIONS = {
  freethrow: new Vector3(0, 0, FREE_THROW_DIST),
  threepoint: [
    new Vector3(-5, 0, 4), new Vector3(-3, 0, 6.5), new Vector3(0, 0, THREE_POINT_DIST),
    new Vector3(3, 0, 6.5), new Vector3(5, 0, 4),
  ],
  halfcourt: new Vector3(0, 0, HALF_COURT_DIST),
};

export const TRICK_SHOTS: TrickShot[] = [
  { name: 'Nothing But Net', desc: 'Swish from free throw', pos: new Vector3(0, 0, FREE_THROW_DIST), requireSwish: true },
  { name: 'Bank It', desc: 'Bank shot off backboard', pos: new Vector3(2, 0, 5), requireSwish: false, requireBank: true },
  { name: 'Corner Three', desc: 'Make it from the corner', pos: new Vector3(6, 0, 3), requireSwish: false },
  { name: 'Downtown', desc: 'Hit from half court', pos: new Vector3(0, 0, HALF_COURT_DIST), requireSwish: false },
  { name: 'Side Swish', desc: 'Swish from the wing', pos: new Vector3(-4, 0, 5), requireSwish: true },
  { name: 'Off the Glass', desc: 'Bank shot from distance', pos: new Vector3(-2, 0, 7), requireSwish: false, requireBank: true },
  { name: 'Baseline Bomb', desc: 'Score from the baseline', pos: new Vector3(7, 0, 1.5), requireSwish: false },
  { name: 'Pure Splash', desc: 'Swish from three-pt arc', pos: new Vector3(3, 0, 6.5), requireSwish: true },
  { name: 'Glass Cleaner', desc: 'Bank from the elbow', pos: new Vector3(3, 0, FREE_THROW_DIST), requireSwish: false, requireBank: true },
  { name: 'Impossible', desc: 'Swish from half court', pos: new Vector3(0, 0, HALF_COURT_DIST), requireSwish: true },
];

// ============================================================
// BALL SKINS
// ============================================================

export interface BallSkin {
  name: string;
  color: number;
  emissive: number;
  emissiveIntensity: number;
  glowColor: number;
  glowOpacity: number;
}

export const BALL_SKINS: BallSkin[] = [
  { name: 'Classic Orange', color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.2, glowColor: 0xff6600, glowOpacity: 0.15 },
  { name: 'Neon Blue', color: 0x0088ff, emissive: 0x0066ff, emissiveIntensity: 0.3, glowColor: 0x0088ff, glowOpacity: 0.2 },
  { name: 'Plasma Green', color: 0x00ff44, emissive: 0x00cc33, emissiveIntensity: 0.3, glowColor: 0x00ff44, glowOpacity: 0.2 },
  { name: 'Hot Pink', color: 0xff00aa, emissive: 0xff0088, emissiveIntensity: 0.3, glowColor: 0xff00aa, glowOpacity: 0.2 },
  { name: 'Gold Rush', color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.25, glowColor: 0xffcc00, glowOpacity: 0.18 },
  { name: 'Void Purple', color: 0x8800ff, emissive: 0x6600cc, emissiveIntensity: 0.35, glowColor: 0x8800ff, glowOpacity: 0.22 },
  { name: 'Ice White', color: 0xccddff, emissive: 0x88aaff, emissiveIntensity: 0.2, glowColor: 0xaaccff, glowOpacity: 0.15 },
  { name: 'Lava Core', color: 0xff2200, emissive: 0xff4400, emissiveIntensity: 0.4, glowColor: 0xff3300, glowOpacity: 0.25 },
];

// ============================================================
// GAME STATE MANAGER
// ============================================================

export class GameStateManager {
  state: GameState = 'title';
  mode: GameMode = 'freethrow';
  score = 0;
  shotsMade = 0;
  shotsTaken = 0;
  streak = 0;
  bestStreak = 0;
  swishCount = 0;
  bankShotCount = 0;
  totalGamesPlayed = 0;
  totalShotsMadeAll = 0;
  themeIndex = 0;
  ballSkinIndex = 0;
  paused = false;

  // Arcade
  arcadeLevel = 1;
  arcadeTimeLeft = 30;
  arcadeMilestonesHit: number[] = [];

  // H.O.R.S.E.
  horseLetters: [string, string] = ['', ''];
  horseCurrentShooter = 0;
  horseChallengeShot: { pos: Vector3; result: ShotResult } | null = null;

  // Trick shots
  trickShotIndex = 0;

  // Daily challenge
  dailyShotIndex = 0;
  dailyScore = 0;

  // Three-point
  threePointRack = 0;
  threePointBallInRack = 0;
  threePointScore = 0;
  threePointTimeLeft = 60;

  // Countdown
  countdownValue = 3;
  countdownTimer = 0;

  // Achievements & leaderboard
  achievements: Achievement[] = ACHIEVEMENTS_DEF.map(a => ({ ...a, unlocked: false }));
  leaderboard: LeaderboardEntry[] = [];

  // Daily challenge
  dailyChallenge: DailyChallenge | null = null;
  careerBestStreak = 0;
  dailyDaysPlayed = 0;
  highScores: Record<string, number> = {};

  resetForGame() {
    this.score = 0;
    this.shotsMade = 0;
    this.shotsTaken = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.swishCount = 0;
    this.bankShotCount = 0;
    this.arcadeLevel = 1;
    this.arcadeTimeLeft = 30;
    this.arcadeMilestonesHit = [];
    this.horseLetters = ['', ''];
    this.horseCurrentShooter = 0;
    this.horseChallengeShot = null;
    this.trickShotIndex = 0;
    this.dailyShotIndex = 0;
    this.dailyScore = 0;
    this.threePointRack = 0;
    this.threePointBallInRack = 0;
    this.threePointScore = 0;
    this.threePointTimeLeft = 60;
  }

  loadSaveData() {
    try {
      const saved = localStorage.getItem('neon-hoops-data');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.achievements) {
          data.achievements.forEach((id: string) => {
            const a = this.achievements.find(a => a.id === id);
            if (a) a.unlocked = true;
          });
        }
        if (data.leaderboard) this.leaderboard = data.leaderboard;
        if (data.totalGames) this.totalGamesPlayed = data.totalGames;
        if (data.totalMade) this.totalShotsMadeAll = data.totalMade;
        if (data.theme !== undefined) this.themeIndex = data.theme;
        if (data.ballSkin !== undefined) this.ballSkinIndex = data.ballSkin;
        if (data.dailyChallenge) this.dailyChallenge = data.dailyChallenge;
        if (data.careerBestStreak) this.careerBestStreak = data.careerBestStreak;
        if (data.dailyDaysPlayed) this.dailyDaysPlayed = data.dailyDaysPlayed;
        if (data.highScores) this.highScores = data.highScores;
      }
    } catch {}
  }

  saveSaveData() {
    try {
      localStorage.setItem('neon-hoops-data', JSON.stringify({
        achievements: this.achievements.filter(a => a.unlocked).map(a => a.id),
        leaderboard: this.leaderboard,
        totalGames: this.totalGamesPlayed,
        totalMade: this.totalShotsMadeAll,
        theme: this.themeIndex,
        ballSkin: this.ballSkinIndex,
        dailyChallenge: this.dailyChallenge,
        careerBestStreak: this.careerBestStreak,
        dailyDaysPlayed: this.dailyDaysPlayed,
        highScores: this.highScores,
      }));
    } catch {}
  }
}
