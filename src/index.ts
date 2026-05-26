// ============================================================
// NEON HOOPS — Main entry point (modularized)
// ============================================================

import {
  World,
  PanelUI,
  PanelDocument,
  Follower,
  FollowBehavior,
  Vector3,
  Fog,
  InputComponent,
  Raycaster,
  Vector2,
  MeshBasicMaterial,
} from '@iwsdk/core';
import type { UIKitDocument } from '@iwsdk/core';

import {
  type GameState, type GameMode, type ShotResult, type TrailPoint,
  GameStateManager, THEMES, TRICK_SHOTS, SHOT_POSITIONS, BALL_SKINS,
  FREE_THROW_DIST, THREE_POINT_DIST, HALF_COURT_DIST, RIM_HEIGHT,
} from './types';
import { AudioManager } from './audio';
import {
  type BallPhysicsState,
  createBallPhysicsState,
  updateBallPhysics,
  launchBall,
  TrailRenderer,
  ArcPreview,
} from './physics';
import { ParticleSystem } from './particles';
import {
  buildCourt,
  applyTheme,
  applyBallSkin,
  animateNet,
  updateEnvironmentAnimations,
  type CourtAssets,
} from './court';
import {
  BallShadow,
  RimGlowIndicator,
  InstantReplay,
  ScorePopupSystem,
  ConfettiSystem,
  WindSystem,
  IdleDribble,
  type ReplayPoint,
} from './effects';

// ============================================================
// HELPERS
// ============================================================

function setText(doc: UIKitDocument | undefined, id: string, text: string) {
  if (!doc) return;
  const el = doc.getElementById(id) as any;
  if (el?.text && typeof el.text === 'object' && 'value' in el.text) {
    el.text.value = text;
  }
}

function bindBtn(doc: UIKitDocument | undefined, id: string, audio: AudioManager, cb: () => void) {
  if (!doc) return;
  const el = doc.getElementById(id);
  if (el) el.addEventListener('click', () => { audio.playButtonClick(); cb(); });
}

// ============================================================
// DAILY CHALLENGE — seeded pseudo-random shots
// ============================================================

function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateDailyShots(seed: number): { pos: Vector3; label: string }[] {
  const rng = seededRandom(seed);
  const labels = ['Free Throw', 'Wing Left', 'Wing Right', 'Top of Key', 'Corner', 'Downtown'];
  const shots: { pos: Vector3; label: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const dist = FREE_THROW_DIST + rng() * (HALF_COURT_DIST - FREE_THROW_DIST);
    const angle = (rng() - 0.5) * 1.5;
    const pos = new Vector3(Math.sin(angle) * dist * 0.4, 0, dist);
    const label = labels[Math.floor(rng() * labels.length)];
    shots.push({ pos, label });
  }
  return shots;
}

// ============================================================
// MAIN
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
  const gs = new GameStateManager();
  gs.loadSaveData();

  // Build court environment
  const assets = buildCourt(world);

  // Particle system
  const particles = new ParticleSystem(world.scene as any);

  // Trail renderer
  const trail = new TrailRenderer(world.scene as any);
  const trailPoints: TrailPoint[] = [];

  // Arc preview
  const arcPreview = new ArcPreview(world.scene as any);

  // Ball physics state
  const ballState = createBallPhysicsState();
  ballState.pos.set(0, 1.2, FREE_THROW_DIST);
  assets.ball.position.copy(ballState.pos);

  // Net animation state
  let netAnimating = false;
  let netAnimStart = 0;

  // ============================================================
  // NEW EFFECT SYSTEMS (Round 4)
  // ============================================================

  const ballShadow = new BallShadow(world.scene as any);
  const rimGlow = new RimGlowIndicator(world.scene as any);
  const replay = new InstantReplay(world.scene as any);
  const scorePopups = new ScorePopupSystem(world.scene as any);
  const confetti = new ConfettiSystem(world.scene as any);
  const wind = new WindSystem();
  const idleDribble = new IdleDribble();
  let lastMakePath: ReplayPoint[] = [];
  let tutorialSeen = false;
  try { tutorialSeen = localStorage.getItem('neon-hoops-tutorial-seen') === 'true'; } catch {}
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  // ============================================================
  // UI ENTITIES
  // ============================================================

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

  // Ballselect panel
  const ballSelectEntity = world.createTransformEntity(undefined, { persistent: true });
  ballSelectEntity.object3D!.position.set(0, 2.5, -2);
  ballSelectEntity.addComponent(PanelUI, { config: '/ui/ballselect.json', maxWidth: 0.6, maxHeight: 0.8 });

  // Daily challenge panel
  const dailyEntity = world.createTransformEntity(undefined, { persistent: true });
  dailyEntity.object3D!.position.set(0, 2.5, -2);
  dailyEntity.addComponent(PanelUI, { config: '/ui/daily.json', maxWidth: 0.6, maxHeight: 0.9 });

  // Stats panel
  const statsEntity = world.createTransformEntity(undefined, { persistent: true });
  statsEntity.object3D!.position.set(0, 2.5, -2);
  statsEntity.addComponent(PanelUI, { config: '/ui/stats.json', maxWidth: 0.6, maxHeight: 1.1 });

  // Tutorial panel
  const tutorialEntity = world.createTransformEntity(undefined, { persistent: true });
  tutorialEntity.object3D!.position.set(0, 2.5, -2);
  tutorialEntity.addComponent(PanelUI, { config: '/ui/tutorial.json', maxWidth: 0.6, maxHeight: 1.0 });

  // Panel visibility
  const allPanelEntities = [
    titleEntity, modeEntity, diffEntity, hudEntity, toastEntity, powerEntity,
    countdownEntity, pauseEntity, goEntity, lbEntity, achEntity, settingsEntity,
    helpEntity, ballSelectEntity, dailyEntity, statsEntity, tutorialEntity,
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
  // GAME LOGIC
  // ============================================================

  function getShotPosition(): Vector3 {
    switch (gs.mode) {
      case 'freethrow':
        return SHOT_POSITIONS.freethrow.clone();
      case 'threepoint':
        return SHOT_POSITIONS.threepoint[gs.threePointRack]?.clone() ?? SHOT_POSITIONS.threepoint[0].clone();
      case 'arcade': {
        // Progressive distance: starts at free throw, gradually pushes further
        const baseDist = FREE_THROW_DIST + Math.min(gs.arcadeLevel - 1, 15) * 0.5;
        // Lateral spread increases with level
        const spreadFactor = Math.min(0.3 + gs.arcadeLevel * 0.05, 0.8);
        const angle = (Math.random() - 0.5) * 2 * spreadFactor;
        return new Vector3(Math.sin(angle) * baseDist * 0.4, 0, Math.min(baseDist, HALF_COURT_DIST));
      }
      case 'horse': {
        const hd = FREE_THROW_DIST + Math.random() * 4;
        const ha = (Math.random() - 0.5) * 1.5;
        return new Vector3(Math.sin(ha) * hd * 0.4, 0, hd);
      }
      case 'trickshot':
        return TRICK_SHOTS[gs.trickShotIndex]?.pos.clone() ?? SHOT_POSITIONS.freethrow.clone();
      case 'daily': {
        const dailyShots = generateDailyShots(getDailySeed());
        const shot = dailyShots[gs.dailyShotIndex];
        return shot ? shot.pos.clone() : SHOT_POSITIONS.freethrow.clone();
      }
      case 'practice':
        return SHOT_POSITIONS.freethrow.clone();
      default:
        return SHOT_POSITIONS.freethrow.clone();
    }
  }

  function resetBallToShotPosition() {
    const pos = getShotPosition();
    ballState.pos.set(pos.x, 1.2, pos.z);
    ballState.vel.set(0, 0, 0);
    assets.ball.position.copy(ballState.pos);
    ballState.inFlight = false;
    ballState.settled = false;
    ballState.shotProcessed = false;
    ballState.settleTimer = 0;
    ballState.bounceCount = 0;
    trailPoints.length = 0;
    assets.shotMarker.position.set(pos.x, 0.02, pos.z);
    assets.shotMarker.visible = true;
  }

  function isGameOver(): boolean {
    switch (gs.mode) {
      case 'freethrow': return gs.shotsTaken >= 10;
      case 'threepoint': return gs.threePointRack >= 5;
      case 'arcade': return gs.arcadeTimeLeft <= 0;
      case 'horse': return gs.horseLetters[0].length >= 5 || gs.horseLetters[1].length >= 5;
      case 'trickshot': return gs.trickShotIndex >= TRICK_SHOTS.length;
      case 'daily': return gs.dailyShotIndex >= 10;
      case 'practice': return false;
      default: return false;
    }
  }

  function shootBall(power: number, aimAngle: number) {
    if (ballState.inFlight) return;
    idleDribble.reset();
    launchBall(ballState, power, aimAngle);
    gs.shotsTaken++;
    audio.playThrow();
    arcPreview.hide();
    updateHUD();
  }

  function handleShotComplete(result: ShotResult) {
    if (result.made) {
      netAnimating = true;
      netAnimStart = elapsedTime;

      // Save replay path for ghost trail
      lastMakePath = replay.commitPath();
      replay.startReplay();

      // Score popup effect
      scorePopups.spawn(assets.ball.position.clone(), result.swish ? 0xff6600 : 0x00aaff);

      if (result.swish) {
        audio.playSwish();
        showToast('SWISH!', `+${result.points}`);
        particles.spawn(assets.ball.position.clone(), 15, 0xff6600);
        if (result.points >= 5) audio.playPerfectShot();
      } else if (result.bankShot) {
        audio.playMake();
        audio.playNetSwoosh();
        showToast('BANK SHOT!', `+${result.points}`);
        particles.spawn(assets.ball.position.clone(), 10, 0x00aaff);
      } else {
        audio.playMake();
        audio.playNetSwoosh();
        showToast('GOOD!', `+${result.points}`);
        particles.spawn(assets.ball.position.clone(), 8, 0x00ff88);
      }

      // Crowd cheer on streaks
      if (gs.streak >= 3) {
        const msgs = ['HOT!', 'ON FIRE!', 'UNSTOPPABLE!', 'LEGENDARY!'];
        const idx = Math.min(gs.streak - 3, msgs.length - 1);
        audio.playCrowdCheer(Math.min(gs.streak / 5, 1.5));
        particles.burstRing(assets.ball.position.clone(), 12, 0xff6600, 4);
        setTimeout(() => showToast(msgs[idx], `${gs.streak} in a row!`), 800);
      }

      // Update career best streak
      if (gs.streak > gs.careerBestStreak) {
        gs.careerBestStreak = gs.streak;
      }

      // Achievement checks
      gs.achievements.find(a => a.id === 'first_basket' && !a.unlocked) && unlockAchievement('first_basket');
      if (gs.streak >= 5) unlockAchievement('sharpshooter');
      if (gs.streak >= 10) unlockAchievement('on_fire');
      if (gs.score >= 100) unlockAchievement('century');
      if (gs.swishCount >= 5) unlockAchievement('swish_master');
      if (gs.bankShotCount >= 3) unlockAchievement('bank_artist');
      if (result.distance >= HALF_COURT_DIST * 0.8) unlockAchievement('long_range');
      if (result.distance >= THREE_POINT_DIST) unlockAchievement('downtown');
      if (gs.totalShotsMadeAll >= 100) unlockAchievement('total_100');
      if (gs.totalShotsMadeAll >= 500) unlockAchievement('total_500');
    } else {
      replay.clearRecording();
      if (gs.streak >= 3) {
        audio.playStreakBreak();
      }
      audio.playMiss();
      showToast('MISS', '');
    }

    handleModeLogic(result);
    updateHUD();
    gs.saveSaveData();

    if (isGameOver()) {
      setTimeout(() => endGame(), 1500);
    } else {
      setTimeout(() => resetBallToShotPosition(), 1500);
    }
  }

  function processMadeShot(): ShotResult {
    const isSwish = ballState.bounceCount === 0;
    const isBankShot = ballState.bounceCount > 0;
    if (isSwish) gs.swishCount++;
    if (isBankShot) gs.bankShotCount++;

    let pts = isSwish ? 3 : 2;
    const distFromShot = getShotPosition().length();
    if (distFromShot >= THREE_POINT_DIST) pts += 1;
    if (distFromShot >= HALF_COURT_DIST * 0.8) pts += 2;

    gs.streak++;
    if (gs.streak >= 3) pts += gs.streak - 2;
    if (gs.streak > gs.bestStreak) gs.bestStreak = gs.streak;
    gs.shotsMade++;
    gs.totalShotsMadeAll++;
    gs.score += pts;

    return { made: true, swish: isSwish, bankShot: isBankShot, points: pts, distance: distFromShot };
  }

  function handleModeLogic(result: ShotResult) {
    switch (gs.mode) {
      case 'freethrow':
        if (gs.shotsTaken >= 10 && gs.shotsMade >= 10) unlockAchievement('perfect_10');
        if (gs.shotsTaken >= 10 && gs.shotsMade / gs.shotsTaken >= 0.8) unlockAchievement('marksman');
        break;
      case 'threepoint':
        gs.threePointBallInRack++;
        if (result.made) gs.threePointScore++;
        if (gs.threePointBallInRack >= 5) {
          gs.threePointBallInRack = 0;
          gs.threePointRack++;
        }
        if (gs.threePointScore >= 20) unlockAchievement('three_pt_20');
        break;
      case 'arcade':
        if (result.made) {
          const prevLevel = gs.arcadeLevel;
          gs.arcadeLevel++;

          // Time bonus: +3s on every make, +5s on swish
          const timeBonus = result.swish ? 5 : 3;
          gs.arcadeTimeLeft += timeBonus;
          audio.playTimeBonus();
          showToast(`+${timeBonus}s`, 'TIME BONUS');

          // Level milestone announcements every 5 levels
          const milestones = [5, 10, 15, 20, 25, 30];
          for (const m of milestones) {
            if (gs.arcadeLevel >= m && prevLevel < m && !gs.arcadeMilestonesHit.includes(m)) {
              gs.arcadeMilestonesHit.push(m);
              audio.playLevelUp();
              const msgs: Record<number, string> = {
                5: 'HEATING UP!', 10: 'ON FIRE!', 15: 'UNSTOPPABLE!',
                20: 'LEGENDARY!', 25: 'MYTHIC!', 30: 'GODLIKE!',
              };
              setTimeout(() => showToast(`LEVEL ${m}`, msgs[m] || 'INCREDIBLE!'), 600);
              confetti.burst(new Vector3(0, 3, -2), 20);
            }
          }

          // Shrink rim visually at higher levels (min 70% of original)
          const rimScale = Math.max(0.7, 1 - (gs.arcadeLevel - 1) * 0.015);
          assets.rimMesh.scale.set(rimScale, 1, rimScale);
        }
        break;
      case 'horse':
        if (gs.horseCurrentShooter === 0) {
          gs.horseChallengeShot = result.made ? { pos: getShotPosition(), result } : null;
          gs.horseCurrentShooter = 1;
          setTimeout(() => {
            if (gs.horseChallengeShot) {
              const aiMakes = Math.random() < 0.5;
              if (!aiMakes) {
                gs.horseLetters[1] += 'HORSE'[gs.horseLetters[1].length];
                showToast('AI MISSES!', `AI: ${gs.horseLetters[1]}`);
              } else {
                showToast('AI MAKES IT!', 'Your turn');
              }
            } else {
              const aiMakes = Math.random() < 0.6;
              if (aiMakes) {
                showToast('AI MAKES IT!', 'Match this shot!');
                gs.horseChallengeShot = { pos: getShotPosition(), result: { made: true, swish: false, bankShot: false, points: 2, distance: 5 } };
              } else {
                showToast('AI MISSES', 'Your shot!');
              }
            }
            gs.horseCurrentShooter = 0;
            gs.horseChallengeShot = null;
          }, 1000);
        } else {
          if (gs.horseChallengeShot && !result.made) {
            gs.horseLetters[0] += 'HORSE'[gs.horseLetters[0].length];
            showToast('MISS!', `You: ${gs.horseLetters[0]}`);
          }
          gs.horseCurrentShooter = 0;
          gs.horseChallengeShot = null;
        }
        if (gs.horseLetters[1].length >= 5) unlockAchievement('horse_winner');
        if (gs.horseLetters[1].length >= 5 && gs.horseLetters[0].length === 0) unlockAchievement('no_miss');
        break;
      case 'trickshot': {
        const trick = TRICK_SHOTS[gs.trickShotIndex];
        if (trick && result.made) {
          if (trick.requireSwish && !result.swish) {
            showToast('NEED SWISH!', 'Try again');
            return;
          }
          if (trick.requireBank && !result.bankShot) {
            showToast('NEED BANK!', 'Off the glass!');
            return;
          }
          gs.trickShotIndex++;
          if (gs.trickShotIndex >= TRICK_SHOTS.length) unlockAchievement('trick_master');
        }
        break;
      }
      case 'daily':
        if (result.made) gs.dailyScore += result.points;
        gs.dailyShotIndex++;
        if (gs.dailyShotIndex >= 10) {
          // Update daily challenge best
          const today = new Date().toISOString().slice(0, 10);
          if (!gs.dailyChallenge || gs.dailyChallenge.date !== today) {
            gs.dailyChallenge = { seed: getDailySeed(), shots: [], date: today, bestScore: gs.dailyScore };
            gs.dailyDaysPlayed++;
          } else if (gs.dailyScore > gs.dailyChallenge.bestScore) {
            gs.dailyChallenge.bestScore = gs.dailyScore;
          }
        }
        break;
    }
  }

  function unlockAchievement(id: string) {
    const a = gs.achievements.find(a => a.id === id);
    if (a && !a.unlocked) {
      a.unlocked = true;
      audio.playAchievement();
      showToast(a.name, 'UNLOCKED!');
      confetti.burst(new Vector3(0, 3, -2), 35);
      gs.saveSaveData();
    }
  }

  function startGame(mode: GameMode) {
    gs.mode = mode;
    gs.resetForGame();
    resetBallToShotPosition();
    // Reset rim scale for fresh game
    assets.rimMesh.scale.set(1, 1, 1);
    gs.state = 'countdown';
    gs.countdownValue = 3;
    gs.countdownTimer = 0;
    showPanel(countdownEntity);
    audio.playCountdownTick();
  }

  function endGame() {
    gs.state = 'gameover';
    audio.playGameOver();
    gs.totalGamesPlayed++;
    if (gs.totalGamesPlayed >= 10) unlockAchievement('games_10');
    if (gs.totalGamesPlayed >= 50) unlockAchievement('games_50');
    if (gs.mode === 'arcade' && gs.score >= 50) unlockAchievement('arcade_50');
    if (gs.mode === 'arcade' && gs.score >= 100) unlockAchievement('arcade_100');

    // Track high scores per mode
    const prevBest = gs.highScores[gs.mode] ?? 0;
    if (gs.score > prevBest) {
      gs.highScores[gs.mode] = gs.score;
    }

    const accuracy = gs.shotsTaken > 0 ? Math.round((gs.shotsMade / gs.shotsTaken) * 100) : 0;
    gs.leaderboard.push({ score: gs.score, mode: gs.mode, accuracy, date: new Date().toLocaleDateString() });
    gs.leaderboard.sort((a, b) => b.score - a.score);
    gs.leaderboard = gs.leaderboard.slice(0, 20);
    gs.saveSaveData();

    const goDoc = goEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(goDoc, 'go-score', `${gs.score}`);
    setText(goDoc, 'go-made', `${gs.shotsMade}/${gs.shotsTaken}`);
    setText(goDoc, 'go-accuracy', `${accuracy}%`);
    setText(goDoc, 'go-streak', `${gs.bestStreak}`);

    if (gs.mode === 'horse') {
      const won = gs.horseLetters[1].length >= 5;
      setText(goDoc, 'go-title', won ? 'YOU WIN!' : 'YOU LOSE');
      setText(goDoc, 'go-subtitle', `You: ${gs.horseLetters[0] || '-'}  AI: ${gs.horseLetters[1] || '-'}`);
    } else if (gs.mode === 'arcade') {
      setText(goDoc, 'go-title', 'GAME OVER');
      const levelMsg = gs.arcadeLevel >= 20 ? 'LEGENDARY RUN!' : gs.arcadeLevel >= 10 ? 'Amazing run!' : gs.arcadeLevel >= 5 ? 'Good run!' : 'Nice try!';
      setText(goDoc, 'go-subtitle', `Level ${gs.arcadeLevel} | ${levelMsg}`);
    } else {
      setText(goDoc, 'go-title', 'GAME OVER');
      setText(goDoc, 'go-subtitle', gs.score >= 50 ? 'Great game!' : 'Nice shooting!');
    }

    showPanel(goEntity);
    assets.ball.visible = false;
    assets.ballGlow.visible = false;
  }

  function resumeGame() {
    gs.state = 'playing';
    gs.paused = false;
    hideAllPanels();
    hudEntity.object3D!.visible = true;
    if (isCharging) powerEntity.object3D!.visible = true;
  }

  function quitToMenu() {
    gs.state = 'title';
    gs.paused = false;
    ballState.inFlight = false;
    assets.ball.visible = true;
    assets.ballGlow.visible = true;
    // Reset rim scale if it was shrunk (arcade mode)
    assets.rimMesh.scale.set(1, 1, 1);
    audio.stopAmbient();
    audio.startAmbient();
    showPanel(titleEntity);
  }

  // ============================================================
  // HUD & UI UPDATES
  // ============================================================

  function updateHUD() {
    const doc = hudEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(doc, 'hud-score', `${gs.score}`);
    setText(doc, 'hud-shots', `${gs.shotsMade}/${gs.shotsTaken}`);
    setText(doc, 'hud-streak', gs.streak > 0 ? `${gs.streak}` : '0');
    const modeNames: Record<GameMode, string> = {
      freethrow: 'FREE THROW', threepoint: '3-PT CONTEST', arcade: 'ARCADE',
      horse: 'H.O.R.S.E.', trickshot: 'TRICK SHOTS', practice: 'PRACTICE',
      daily: 'DAILY CHALLENGE',
    };
    setText(doc, 'hud-mode', modeNames[gs.mode] || gs.mode.toUpperCase());
    let info = '';
    switch (gs.mode) {
      case 'freethrow': info = `${10 - gs.shotsTaken} left`; break;
      case 'threepoint': info = `Rack ${gs.threePointRack + 1}/5`; break;
      case 'arcade': info = `Lvl ${gs.arcadeLevel} | ${Math.ceil(gs.arcadeTimeLeft)}s`; break;
      case 'horse': info = `You: ${gs.horseLetters[0] || '-'}  AI: ${gs.horseLetters[1] || '-'}`; break;
      case 'trickshot': info = TRICK_SHOTS[gs.trickShotIndex]?.name ?? 'Done'; break;
      case 'daily': {
        const dailyShots = generateDailyShots(getDailySeed());
        const shotLabel = dailyShots[gs.dailyShotIndex]?.label ?? 'Done';
        info = `${gs.dailyShotIndex + 1}/10 — ${shotLabel}`;
        break;
      }
      case 'practice': info = 'No pressure'; break;
    }
    setText(doc, 'hud-info', info);
    setText(doc, 'hud-wind', wind.getDirectionLabel());
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
      const entry = gs.leaderboard[i];
      setText(doc, `lb-s${i}`, entry ? `${entry.score}` : '--');
      setText(doc, `lb-m${i}`, entry ? entry.mode.toUpperCase() : '--');
      setText(doc, `lb-d${i}`, entry ? entry.date : '--');
    }
  }

  function updateAchievementsUI() {
    const doc = achEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    const unlocked = gs.achievements.filter(a => a.unlocked).length;
    setText(doc, 'ach-count', `${unlocked} / ${gs.achievements.length} Unlocked`);
    for (let i = 0; i < 20; i++) {
      const a = gs.achievements[i];
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
    setText(doc, 'theme-name', THEMES[gs.themeIndex].name);
  }

  function updateBallSelectUI() {
    const doc = ballSelectEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(doc, 'ball-name', BALL_SKINS[gs.ballSkinIndex].name);
  }

  function updateDailyUI() {
    const doc = dailyEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    setText(doc, 'daily-date', dateStr);
    const today = now.toISOString().slice(0, 10);
    const best = gs.dailyChallenge?.date === today ? `Best: ${gs.dailyChallenge.bestScore}` : 'Best: --';
    setText(doc, 'daily-best', best);
  }

  function updateStatsUI() {
    const doc = statsEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(doc, 'stat-games', `${gs.totalGamesPlayed}`);
    setText(doc, 'stat-makes', `${gs.totalShotsMadeAll}`);
    setText(doc, 'stat-streak', `${gs.careerBestStreak}`);
    const achCount = gs.achievements.filter(a => a.unlocked).length;
    setText(doc, 'stat-achs', `${achCount}/${gs.achievements.length}`);
    const today = new Date().toISOString().slice(0, 10);
    setText(doc, 'stat-daily-best', gs.dailyChallenge?.date === today ? `${gs.dailyChallenge.bestScore}` : '--');
    setText(doc, 'stat-daily-days', `${gs.dailyDaysPlayed}`);
    setText(doc, 'stat-hi-ft', gs.highScores['freethrow'] ? `${gs.highScores['freethrow']}` : '--');
    setText(doc, 'stat-hi-3pt', gs.highScores['threepoint'] ? `${gs.highScores['threepoint']}` : '--');
    setText(doc, 'stat-hi-arcade', gs.highScores['arcade'] ? `${gs.highScores['arcade']}` : '--');
  }

  // ============================================================
  // UI BINDING
  // ============================================================

  let uiBound = false;

  function tryBindUI() {
    const titleDoc = titleEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    if (!titleDoc) return;
    uiBound = true;

    bindBtn(titleDoc, 'btn-play', audio, () => startGame('freethrow'));
    bindBtn(titleDoc, 'btn-modes', audio, () => { gs.state = 'modeselect'; showPanel(modeEntity); });
    bindBtn(titleDoc, 'btn-leaderboard', audio, () => { gs.state = 'leaderboard'; updateLeaderboardUI(); showPanel(lbEntity); });
    bindBtn(titleDoc, 'btn-achievements', audio, () => { gs.state = 'achievements'; updateAchievementsUI(); showPanel(achEntity); });
    bindBtn(titleDoc, 'btn-stats', audio, () => { updateStatsUI(); showPanel(statsEntity); });
    bindBtn(titleDoc, 'btn-settings', audio, () => { gs.state = 'settings'; updateSettingsUI(); showPanel(settingsEntity); });
    bindBtn(titleDoc, 'btn-help', audio, () => { gs.state = 'help'; showPanel(helpEntity); });

    const modeDoc = modeEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(modeDoc, 'btn-freethrow', audio, () => startGame('freethrow'));
    bindBtn(modeDoc, 'btn-threepoint', audio, () => startGame('threepoint'));
    bindBtn(modeDoc, 'btn-arcade', audio, () => { gs.mode = 'arcade'; gs.state = 'difficulty'; showPanel(diffEntity); });
    bindBtn(modeDoc, 'btn-horse', audio, () => { gs.mode = 'horse'; gs.state = 'difficulty'; showPanel(diffEntity); });
    bindBtn(modeDoc, 'btn-trickshot', audio, () => startGame('trickshot'));
    bindBtn(modeDoc, 'btn-daily', audio, () => { updateDailyUI(); showPanel(dailyEntity); });
    bindBtn(modeDoc, 'btn-practice', audio, () => startGame('practice'));
    bindBtn(modeDoc, 'btn-modes-back', audio, () => { gs.state = 'title'; showPanel(titleEntity); });

    const diffDoc = diffEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(diffDoc, 'btn-easy', audio, () => { difficulty = 'easy'; wind.setDifficulty('easy'); startGame(gs.mode); });
    bindBtn(diffDoc, 'btn-medium', audio, () => { difficulty = 'medium'; wind.setDifficulty('medium'); startGame(gs.mode); });
    bindBtn(diffDoc, 'btn-hard', audio, () => { difficulty = 'hard'; wind.setDifficulty('hard'); startGame(gs.mode); });
    bindBtn(diffDoc, 'btn-diff-back', audio, () => { gs.state = 'modeselect'; showPanel(modeEntity); });

    const pauseDoc = pauseEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(pauseDoc, 'btn-resume', audio, () => resumeGame());
    bindBtn(pauseDoc, 'btn-quit', audio, () => quitToMenu());

    const goDoc = goEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(goDoc, 'btn-replay', audio, () => startGame(gs.mode));
    bindBtn(goDoc, 'btn-menu', audio, () => quitToMenu());

    const lbDoc = lbEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(lbDoc, 'btn-lb-back', audio, () => { gs.state = 'title'; showPanel(titleEntity); });

    const achDoc = achEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(achDoc, 'btn-ach-back', audio, () => { gs.state = 'title'; showPanel(titleEntity); });

    // Settings
    const settingsDoc = settingsEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(settingsDoc, 'btn-master-up', audio, () => { audio.masterVol = Math.min(1, audio.masterVol + 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-master-down', audio, () => { audio.masterVol = Math.max(0, audio.masterVol - 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-sfx-up', audio, () => { audio.sfxVol = Math.min(1, audio.sfxVol + 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-sfx-down', audio, () => { audio.sfxVol = Math.max(0, audio.sfxVol - 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-music-up', audio, () => { audio.musicVol = Math.min(1, audio.musicVol + 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-music-down', audio, () => { audio.musicVol = Math.max(0, audio.musicVol - 0.1); audio.updateVolumes(); updateSettingsUI(); });
    bindBtn(settingsDoc, 'btn-theme-prev', audio, () => {
      gs.themeIndex = (gs.themeIndex - 1 + THEMES.length) % THEMES.length;
      applyTheme(assets, THEMES[gs.themeIndex], world.scene.fog as Fog);
      updateSettingsUI();
      gs.saveSaveData();
    });
    bindBtn(settingsDoc, 'btn-theme-next', audio, () => {
      gs.themeIndex = (gs.themeIndex + 1) % THEMES.length;
      applyTheme(assets, THEMES[gs.themeIndex], world.scene.fog as Fog);
      updateSettingsUI();
      gs.saveSaveData();
    });
    bindBtn(settingsDoc, 'btn-ball-select', audio, () => { updateBallSelectUI(); showPanel(ballSelectEntity); });
    bindBtn(settingsDoc, 'btn-settings-back', audio, () => { gs.state = 'title'; showPanel(titleEntity); });

    // Ball select
    const ballDoc = ballSelectEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(ballDoc, 'btn-ball-prev', audio, () => {
      gs.ballSkinIndex = (gs.ballSkinIndex - 1 + BALL_SKINS.length) % BALL_SKINS.length;
      applyBallSkin(assets, BALL_SKINS[gs.ballSkinIndex]);
      trail.setColor(BALL_SKINS[gs.ballSkinIndex].glowColor);
      updateBallSelectUI();
      gs.saveSaveData();
    });
    bindBtn(ballDoc, 'btn-ball-next', audio, () => {
      gs.ballSkinIndex = (gs.ballSkinIndex + 1) % BALL_SKINS.length;
      applyBallSkin(assets, BALL_SKINS[gs.ballSkinIndex]);
      trail.setColor(BALL_SKINS[gs.ballSkinIndex].glowColor);
      updateBallSelectUI();
      gs.saveSaveData();
    });
    bindBtn(ballDoc, 'btn-ball-back', audio, () => { gs.state = 'settings'; updateSettingsUI(); showPanel(settingsEntity); });

    // Help
    const helpDoc = helpEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(helpDoc, 'btn-help-back', audio, () => { gs.state = 'title'; showPanel(titleEntity); });

    // Daily challenge
    const dailyDoc = dailyEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(dailyDoc, 'btn-daily-play', audio, () => startGame('daily'));
    bindBtn(dailyDoc, 'btn-daily-back', audio, () => { gs.state = 'modeselect'; showPanel(modeEntity); });

    // Stats
    const statsDoc = statsEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(statsDoc, 'btn-stats-back', audio, () => { gs.state = 'title'; showPanel(titleEntity); });

    // Tutorial
    const tutDoc = tutorialEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    bindBtn(tutDoc, 'btn-tut-play', audio, () => {
      tutorialSeen = true;
      try { localStorage.setItem('neon-hoops-tutorial-seen', 'true'); } catch {}
      showPanel(titleEntity);
    });
    bindBtn(tutDoc, 'btn-tut-skip', audio, () => {
      tutorialSeen = true;
      try { localStorage.setItem('neon-hoops-tutorial-seen', 'true'); } catch {}
      showPanel(titleEntity);
    });

    // Apply loaded settings
    if (!tutorialSeen) {
      showPanel(tutorialEntity);
    } else {
      showPanel(titleEntity);
    }
    audio.startAmbient();
    audio.startSynthwaveMusic();
    applyTheme(assets, THEMES[gs.themeIndex], world.scene.fog as Fog);
    applyBallSkin(assets, BALL_SKINS[gs.ballSkinIndex]);
    trail.setColor(BALL_SKINS[gs.ballSkinIndex].glowColor);
  }

  // ============================================================
  // INPUT — BROWSER
  // ============================================================

  let isCharging = false;
  let chargePower = 0;
  let aimX = 0;
  let mouseY = 0;

  container.addEventListener('mousedown', (e) => {
    if (gs.state !== 'playing' || ballState.inFlight) return;
    isCharging = true;
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
    // Charge hum feedback
    if (chargePower > 0.1 && Math.random() < 0.15) {
      audio.playChargeHum(chargePower);
    }
    // Show arc preview while charging
    if (chargePower > 0.1) {
      arcPreview.show(ballState.pos.clone(), chargePower, aimX);
    }
  });

  container.addEventListener('mouseup', () => {
    if (!isCharging) return;
    isCharging = false;
    powerEntity.object3D!.visible = false;
    arcPreview.hide();
    if (gs.state === 'playing' && !ballState.inFlight && chargePower > 0.05) {
      shootBall(chargePower, aimX);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (gs.state === 'playing') {
        gs.state = 'paused';
        gs.paused = true;
        showPanel(pauseEntity);
      } else if (gs.state === 'paused') {
        resumeGame();
      }
    }
    // Quick restart with R key during gameover
    if (e.key === 'r' || e.key === 'R') {
      if (gs.state === 'gameover') {
        startGame(gs.mode);
      }
    }
    // Quick menu with M key during gameover
    if (e.key === 'm' || e.key === 'M') {
      if (gs.state === 'gameover') {
        quitToMenu();
      }
    }
    // Number keys 1-7 for quick mode select from title
    if (gs.state === 'title' || gs.state === 'modeselect') {
      if (e.key === '1') startGame('freethrow');
      else if (e.key === '2') startGame('threepoint');
      else if (e.key === '3') startGame('arcade');
      else if (e.key === '4') { gs.mode = 'horse'; gs.state = 'difficulty'; showPanel(diffEntity); }
      else if (e.key === '5') startGame('trickshot');
      else if (e.key === '6') { updateDailyUI(); showPanel(dailyEntity); }
      else if (e.key === '7') startGame('practice');
    }
  });

  // ============================================================
  // INPUT — XR CONTROLLERS
  // ============================================================

  let xrCharging = false;
  let xrChargeStart = 0;

  // ============================================================
  // PHYSICS CALLBACKS
  // ============================================================

  const physicsCallbacks = {
    onBackboardHit: (pos: Vector3) => {
      audio.playBackboardHit();
      particles.spawn(pos, 5, 0x00aaff);
    },
    onRimHit: (pos: Vector3) => {
      audio.playRimHit();
      particles.spawn(pos, 3, 0xff4400);
    },
    onFloorBounce: () => {
      audio.playBounceFloor();
    },
    onPassThroughHoop: () => {
      const result = processMadeShot();
      handleShotComplete(result);
    },
    onSettled: () => {
      gs.streak = 0;
      handleShotComplete({ made: false, swish: false, bankShot: false, points: 0, distance: 0 });
    },
    onOutOfBounds: () => {
      gs.streak = 0;
      handleShotComplete({ made: false, swish: false, bankShot: false, points: 0, distance: 0 });
    },
  };

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

    if (!uiBound) tryBindUI();

    // Countdown
    if (gs.state === 'countdown') {
      gs.countdownTimer += dt;
      if (gs.countdownTimer >= 1) {
        gs.countdownTimer = 0;
        gs.countdownValue--;
        const cdDoc = countdownEntity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
        if (gs.countdownValue > 0) {
          setText(cdDoc, 'cd-num', `${gs.countdownValue}`);
          audio.playCountdownTick();
        } else {
          setText(cdDoc, 'cd-num', 'GO!');
          setText(cdDoc, 'cd-label', '');
          audio.playGameStart();
          setTimeout(() => {
            gs.state = 'playing';
            hideAllPanels();
            hudEntity.object3D!.visible = true;
            assets.ball.visible = true;
            assets.ballGlow.visible = true;
            updateHUD();
          }, 500);
        }
      }
    }

    // Toast timer
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEntity.object3D!.visible = false;
    }

    // Game logic
    if (gs.state === 'playing' && !gs.paused) {
      // Rim scale for arcade mode (shrinks at higher levels)
      const rimScale = gs.mode === 'arcade' ? Math.max(0.7, 1 - (gs.arcadeLevel - 1) * 0.015) : 1.0;
      updateBallPhysics(ballState, dt, assets.ball, trailPoints, physicsCallbacks, rimScale);

      // Arcade timer
      if (gs.mode === 'arcade' && !ballState.inFlight) {
        gs.arcadeTimeLeft -= dt;
        if (gs.arcadeTimeLeft <= 0) {
          gs.arcadeTimeLeft = 0;
          endGame();
        }
        updateHUD();
      }

      // Three-point timer
      if (gs.mode === 'threepoint') {
        gs.threePointTimeLeft -= dt;
        if (gs.threePointTimeLeft <= 0) {
          gs.threePointRack = 5;
          endGame();
        }
      }

      // XR input
      const rightGamepad = (world.input as any).xr?.gamepads?.right;
      if (rightGamepad) {
        const triggerDown = rightGamepad.getButtonDown?.(InputComponent.Trigger);
        const triggerPressed = rightGamepad.getButtonPressed?.(InputComponent.Trigger);
        const triggerUp = rightGamepad.getButtonUp?.(InputComponent.Trigger);

        if (triggerDown && !ballState.inFlight) {
          xrCharging = true;
          xrChargeStart = now;
          powerEntity.object3D!.visible = true;
        }

        if (xrCharging && triggerPressed) {
          const elapsed = (now - xrChargeStart) / 1000;
          chargePower = Math.min(1, elapsed / 1.5);
          updatePowerBar(chargePower);
          if (chargePower > 0.1) {
            arcPreview.show(ballState.pos.clone(), chargePower, 0);
          }
        }

        if (triggerUp && xrCharging) {
          xrCharging = false;
          powerEntity.object3D!.visible = false;
          arcPreview.hide();
          if (chargePower > 0.05) {
            shootBall(chargePower, 0);
          }
        }

        if (rightGamepad.getButtonDown?.(InputComponent.B_Button)) {
          if (gs.state === 'playing') {
            gs.state = 'paused';
            gs.paused = true;
            showPanel(pauseEntity);
          }
        }
      }
    }

    // Particles
    particles.update(dt);

    // Ball trail
    trail.update(trailPoints, dt);

    // ============================================================
    // Round 4 Effect Updates
    // ============================================================

    // Ball shadow follows ball position
    ballShadow.update(ballState.pos);

    // Rim glow indicator
    rimGlow.update(ballState.pos, ballState.inFlight);

    // Instant replay ghost trail
    if (ballState.inFlight) {
      replay.recordPoint(ballState.pos, elapsedTime);
    }
    replay.update(dt, lastMakePath);

    // Score popups float upward
    scorePopups.update(dt);

    // Confetti
    confetti.update(dt);

    // Wind system
    wind.update(dt);
    if (ballState.inFlight && wind.getDirectionLabel() !== '') {
      wind.applyToBall(ballState.vel, dt);
    }

    // Idle dribble animation
    if (gs.state === 'playing' && !ballState.inFlight) {
      const dribbleHit = idleDribble.update(dt, ballState.pos, ballState.inFlight, true);
      assets.ball.position.copy(ballState.pos);
      if (dribbleHit) audio.playDribble();
    }

    // Net animation
    if (netAnimating) {
      const netElapsed = elapsedTime - netAnimStart;
      const intensity = Math.max(0, 1 - netElapsed / 1.5);
      animateNet(assets.netGroup, elapsedTime, intensity);
      if (intensity <= 0) netAnimating = false;
    }

    // Environment animations
    updateEnvironmentAnimations(assets, elapsedTime, dt);

    requestAnimationFrame(update);
  }

  update();
}

main().catch(console.error);
