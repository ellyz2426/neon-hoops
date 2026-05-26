// ============================================================
// EFFECTS — ball shadow, rim glow, replay ghost, score popups,
//           confetti, wind, idle dribble
// ============================================================

import {
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  PlaneGeometry,
  CircleGeometry,
  Vector3,
  Group,
  Color,
  AdditiveBlending,
} from '@iwsdk/core';
import { BALL_RADIUS, RIM_HEIGHT, RIM_RADIUS, GRAVITY } from './types';

// ============================================================
// BALL SHADOW
// ============================================================

export class BallShadow {
  private shadow: Mesh;
  private mat: MeshBasicMaterial;

  constructor(scene: Group) {
    this.mat = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    });
    this.shadow = new Mesh(new CircleGeometry(BALL_RADIUS * 1.2, 16), this.mat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.005;
    scene.add(this.shadow);
  }

  update(ballPos: Vector3) {
    this.shadow.position.x = ballPos.x;
    this.shadow.position.z = ballPos.z;
    // Scale & opacity based on height — higher ball = smaller/lighter shadow
    const heightFactor = Math.max(0, 1 - ballPos.y / 8);
    const scale = 0.5 + heightFactor * 0.8;
    this.shadow.scale.setScalar(scale);
    this.mat.opacity = 0.15 * heightFactor;
    this.shadow.visible = ballPos.y > 0.1;
  }
}

// ============================================================
// RIM GLOW INDICATOR — color shifts based on ball proximity
// ============================================================

export class RimGlowIndicator {
  private glowRing: Mesh;
  private mat: MeshBasicMaterial;

  constructor(scene: Group) {
    this.mat = new MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
    });
    // Flat ring at hoop height
    const geo = new PlaneGeometry(RIM_RADIUS * 3.2, RIM_RADIUS * 3.2);
    this.glowRing = new Mesh(geo, this.mat);
    this.glowRing.rotation.x = -Math.PI / 2;
    this.glowRing.position.set(0, RIM_HEIGHT + 0.01, 0);
    this.glowRing.visible = false;
    scene.add(this.glowRing);
  }

  update(ballPos: Vector3, ballInFlight: boolean) {
    if (!ballInFlight) {
      this.glowRing.visible = false;
      return;
    }

    // Only show when ball is near hoop height and within range
    const dy = Math.abs(ballPos.y - RIM_HEIGHT);
    const horiz = Math.sqrt(ballPos.x * ballPos.x + ballPos.z * ballPos.z);

    if (dy < 1.5 && horiz < RIM_RADIUS * 4) {
      this.glowRing.visible = true;
      // Distance from center of hoop — green=perfect, yellow=close, red=miss
      const centerDist = horiz / RIM_RADIUS;
      if (centerDist < 0.6) {
        this.mat.color.setHex(0x00ff44); // Dead center — green
      } else if (centerDist < 1.0) {
        this.mat.color.setHex(0xffff00); // Close — yellow
      } else if (centerDist < 1.5) {
        this.mat.color.setHex(0xff8800); // Rim area — orange
      } else {
        this.mat.color.setHex(0xff0000); // Missing — red
      }
      // Fade based on vertical proximity
      this.mat.opacity = Math.max(0, 0.12 * (1 - dy / 1.5));
    } else {
      this.glowRing.visible = false;
    }
  }
}

// ============================================================
// INSTANT REPLAY — ghost trail of last successful shot
// ============================================================

export interface ReplayPoint {
  pos: Vector3;
  time: number;
}

export class InstantReplay {
  private ghostDots: Mesh[] = [];
  private scene: Group;
  private savedPath: ReplayPoint[] = [];
  private active = false;
  private replayTime = 0;
  private maxDots = 25;

  constructor(scene: Group) {
    this.scene = scene;
    const mat = new MeshBasicMaterial({
      color: 0x44ddff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
    });
    for (let i = 0; i < this.maxDots; i++) {
      const dot = new Mesh(new SphereGeometry(0.025, 4, 4), mat.clone());
      dot.visible = false;
      scene.add(dot);
      this.ghostDots.push(dot);
    }
  }

  /** Record the current ball position during flight */
  recordPoint(pos: Vector3, time: number) {
    this.savedPath.push({ pos: pos.clone(), time });
    if (this.savedPath.length > 200) this.savedPath.shift();
  }

  /** Start replay after a successful make */
  startReplay() {
    if (this.savedPath.length < 5) return;
    this.active = true;
    this.replayTime = 0;
  }

  /** Save current path as the "last shot" and clear recording buffer */
  commitPath(): ReplayPoint[] {
    const path = [...this.savedPath];
    this.savedPath = [];
    return path;
  }

  /** Clear the recording buffer without saving */
  clearRecording() {
    this.savedPath = [];
  }

  update(dt: number, lastMakePath: ReplayPoint[]) {
    if (!this.active || lastMakePath.length === 0) {
      this.ghostDots.forEach(d => { d.visible = false; });
      return;
    }

    this.replayTime += dt;
    const totalDuration = lastMakePath[lastMakePath.length - 1].time - lastMakePath[0].time;

    if (this.replayTime > totalDuration + 1.0) {
      // Replay finished
      this.active = false;
      this.ghostDots.forEach(d => { d.visible = false; });
      return;
    }

    // Show dots along the path up to current replay time
    const startTime = lastMakePath[0].time;
    const fadeWindow = 0.8;

    for (let i = 0; i < this.maxDots; i++) {
      const t = (i / this.maxDots) * totalDuration;
      if (t > this.replayTime) {
        this.ghostDots[i].visible = false;
        continue;
      }

      // Find closest recorded point
      const targetTime = startTime + t;
      let closest = lastMakePath[0];
      for (const p of lastMakePath) {
        if (Math.abs(p.time - targetTime) < Math.abs(closest.time - targetTime)) {
          closest = p;
        }
      }

      this.ghostDots[i].position.copy(closest.pos);
      this.ghostDots[i].visible = true;

      // Fade: newest dots brighter, old dots fade
      const age = this.replayTime - t;
      const alpha = Math.max(0, 0.5 * (1 - age / fadeWindow));
      (this.ghostDots[i].material as MeshBasicMaterial).opacity = alpha;
      this.ghostDots[i].scale.setScalar(0.5 + alpha);
    }
  }
}

// ============================================================
// SCORE POPUP — floating "+N" text effect using PanelUI-safe mesh
// ============================================================

export interface ScorePopup {
  mesh: Mesh;
  vel: Vector3;
  life: number;
  maxLife: number;
}

export class ScorePopupSystem {
  private popups: ScorePopup[] = [];
  private scene: Group;

  constructor(scene: Group) {
    this.scene = scene;
  }

  spawn(pos: Vector3, color: number) {
    const mat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
    });
    // Use a small star-like shape instead of text (PanelUI handles text, this is a visual accent)
    const mesh = new Mesh(new SphereGeometry(0.04, 6, 6), mat);
    mesh.position.copy(pos);
    mesh.position.y += 0.5;
    this.scene.add(mesh);

    this.popups.push({
      mesh,
      vel: new Vector3((Math.random() - 0.5) * 0.5, 2.5, (Math.random() - 0.5) * 0.5),
      life: 0,
      maxLife: 1.5,
    });
  }

  update(dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life += dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.vel.y -= 1.5 * dt; // Slow gravity
      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha * 0.9;
      p.mesh.scale.setScalar(1 + p.life * 0.5); // Grow as they rise

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.popups.splice(i, 1);
      }
    }
  }

  clear() {
    this.popups.forEach(p => this.scene.remove(p.mesh));
    this.popups.length = 0;
  }
}

// ============================================================
// CONFETTI BURST — for achievements & big moments
// ============================================================

export interface ConfettiPiece {
  mesh: Mesh;
  vel: Vector3;
  rotVel: Vector3;
  life: number;
  maxLife: number;
}

export class ConfettiSystem {
  private pieces: ConfettiPiece[] = [];
  private scene: Group;
  private maxPieces = 60;

  constructor(scene: Group) {
    this.scene = scene;
  }

  burst(pos: Vector3, count: number = 30) {
    const colors = [0xff0044, 0xff8800, 0xffff00, 0x00ff44, 0x00aaff, 0xff00ff, 0xffffff];
    for (let i = 0; i < count && this.pieces.length < this.maxPieces; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      // Flat confetti rectangle
      const w = 0.015 + Math.random() * 0.02;
      const h = 0.03 + Math.random() * 0.04;
      const mesh = new Mesh(new PlaneGeometry(w, h), mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      this.pieces.push({
        mesh,
        vel: new Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 3,
          (Math.random() - 0.5) * 6,
        ),
        rotVel: new Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
        ),
        life: 0,
        maxLife: 2.0 + Math.random() * 1.0,
      });
    }
  }

  update(dt: number) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.life += dt;
      p.vel.y += GRAVITY * 0.3 * dt; // Slow-falling confetti
      // Flutter effect
      p.vel.x += Math.sin(p.life * 5 + i) * 0.5 * dt;
      p.vel.z += Math.cos(p.life * 4 + i) * 0.5 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;

      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha * 0.9;

      if (p.life >= p.maxLife || p.mesh.position.y < -1) {
        this.scene.remove(p.mesh);
        this.pieces.splice(i, 1);
      }
    }
  }

  clear() {
    this.pieces.forEach(p => this.scene.remove(p.mesh));
    this.pieces.length = 0;
  }
}

// ============================================================
// WIND SYSTEM — affects ball trajectory based on difficulty
// ============================================================

export class WindSystem {
  windX = 0;
  windZ = 0;
  private strength = 0;
  private changeTimer = 0;
  private targetX = 0;
  private targetZ = 0;

  setDifficulty(level: 'easy' | 'medium' | 'hard') {
    switch (level) {
      case 'easy': this.strength = 0; break;
      case 'medium': this.strength = 0.8; break;
      case 'hard': this.strength = 2.0; break;
    }
  }

  update(dt: number) {
    this.changeTimer += dt;
    if (this.changeTimer > 3.0) {
      this.changeTimer = 0;
      this.targetX = (Math.random() - 0.5) * 2 * this.strength;
      this.targetZ = (Math.random() - 0.5) * 2 * this.strength;
    }
    // Smooth lerp toward target
    this.windX += (this.targetX - this.windX) * dt * 0.5;
    this.windZ += (this.targetZ - this.windZ) * dt * 0.5;
  }

  /** Apply wind force to ball velocity */
  applyToBall(vel: Vector3, dt: number) {
    vel.x += this.windX * dt;
    vel.z += this.windZ * dt;
  }

  getDirectionLabel(): string {
    if (this.strength === 0) return '';
    const mag = Math.sqrt(this.windX * this.windX + this.windZ * this.windZ);
    if (mag < 0.2) return 'CALM';
    let dir = '';
    if (this.windZ < -0.2) dir += 'N';
    if (this.windZ > 0.2) dir += 'S';
    if (this.windX < -0.2) dir += 'W';
    if (this.windX > 0.2) dir += 'E';
    return `WIND: ${dir} ${mag.toFixed(1)}`;
  }
}

// ============================================================
// IDLE BALL DRIBBLE ANIMATION
// ============================================================

export class IdleDribble {
  private timer = 0;
  private bouncing = false;
  private bouncePhase = 0;
  private baseY = 1.2;

  update(dt: number, ballPos: Vector3, inFlight: boolean, isPlaying: boolean): boolean {
    if (inFlight || !isPlaying) {
      this.timer = 0;
      this.bouncing = false;
      return false;
    }

    this.timer += dt;

    // Start idle dribble after 3 seconds of inactivity
    if (this.timer < 3.0 && !this.bouncing) return false;

    this.bouncing = true;
    this.bouncePhase += dt * 4; // Dribble speed

    // Smooth bounce curve
    const bounce = Math.abs(Math.sin(this.bouncePhase)) * 0.25;
    ballPos.y = this.baseY + bounce;

    // Return true when ball hits bottom of bounce (for dribble sound)
    const prevBounce = Math.abs(Math.sin(this.bouncePhase - dt * 4));
    return bounce < 0.02 && prevBounce > 0.02;
  }

  reset() {
    this.timer = 0;
    this.bouncing = false;
    this.bouncePhase = 0;
  }
}
