// ============================================================
// BALL PHYSICS — arc trajectory, collisions, settling
// ============================================================

import {
  Vector3,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  AdditiveBlending,
  Group,
} from '@iwsdk/core';
import {
  GRAVITY, BALL_RADIUS, RIM_RADIUS, RIM_HEIGHT,
  BACKBOARD_WIDTH, BACKBOARD_HEIGHT,
  type TrailPoint,
} from './types';
import { AudioManager } from './audio';

export interface BallPhysicsState {
  pos: Vector3;
  vel: Vector3;
  inFlight: boolean;
  settled: boolean;
  shotProcessed: boolean;
  settleTimer: number;
  bounceCount: number;
}

export function createBallPhysicsState(): BallPhysicsState {
  return {
    pos: new Vector3(0, 1.2, 4.6),
    vel: new Vector3(0, 0, 0),
    inFlight: false,
    settled: false,
    shotProcessed: false,
    settleTimer: 0,
    bounceCount: 0,
  };
}

export interface PhysicsCallbacks {
  onBackboardHit: (pos: Vector3) => void;
  onRimHit: (pos: Vector3) => void;
  onFloorBounce: () => void;
  onPassThroughHoop: () => void;
  onSettled: () => void;
  onOutOfBounds: () => void;
}

/**
 * Run one frame of ball physics with 4-substep integration.
 * Returns true if the ball is still in flight.
 */
export function updateBallPhysics(
  state: BallPhysicsState,
  dt: number,
  ball: Mesh,
  trailPoints: TrailPoint[],
  callbacks: PhysicsCallbacks,
  rimScale: number = 1.0,
): boolean {
  if (!state.inFlight) return false;

  const substeps = 4;
  const subDt = dt / substeps;
  const effectiveRimRadius = RIM_RADIUS * rimScale;

  for (let s = 0; s < substeps; s++) {
    // Gravity
    state.vel.y += GRAVITY * subDt;

    // Position
    state.pos.x += state.vel.x * subDt;
    state.pos.y += state.vel.y * subDt;
    state.pos.z += state.vel.z * subDt;

    // Floor bounce
    if (state.pos.y < BALL_RADIUS) {
      state.pos.y = BALL_RADIUS;
      state.vel.y *= -0.6;
      state.vel.x *= 0.8;
      state.vel.z *= 0.8;
      if (Math.abs(state.vel.y) > 0.3) {
        callbacks.onFloorBounce();
      }
    }

    // Backboard collision
    if (state.pos.z < -0.13 && state.pos.z > -0.2 &&
        Math.abs(state.pos.x) < BACKBOARD_WIDTH / 2 &&
        state.pos.y > RIM_HEIGHT - 0.1 && state.pos.y < RIM_HEIGHT + BACKBOARD_HEIGHT) {
      state.pos.z = -0.13;
      state.vel.z *= -0.65;
      state.bounceCount++;
      callbacks.onBackboardHit(state.pos.clone());
    }

    // Rim collision (uses effective rim radius for arcade scaling)
    const dx = state.pos.x;
    const dz = state.pos.z;
    const rimDist = Math.sqrt(dx * dx + dz * dz);
    const rimDiff = Math.abs(rimDist - effectiveRimRadius);

    if (rimDiff < BALL_RADIUS + 0.02 && Math.abs(state.pos.y - RIM_HEIGHT) < BALL_RADIUS + 0.05) {
      const nx = dx / (rimDist || 1);
      const nz = dz / (rimDist || 1);
      const dot = state.vel.x * nx + state.vel.z * nz;
      state.vel.x -= 1.5 * dot * nx;
      state.vel.z -= 1.5 * dot * nz;
      state.vel.y *= 0.7;

      if (rimDist < effectiveRimRadius) {
        state.pos.x = nx * (effectiveRimRadius - BALL_RADIUS - 0.03);
        state.pos.z = nz * (effectiveRimRadius - BALL_RADIUS - 0.03);
      } else {
        state.pos.x = nx * (effectiveRimRadius + BALL_RADIUS + 0.03);
        state.pos.z = nz * (effectiveRimRadius + BALL_RADIUS + 0.03);
      }

      state.bounceCount++;
      callbacks.onRimHit(state.pos.clone());
    }

    // Pass through hoop (uses effective rim radius)
    if (!state.shotProcessed && state.pos.y < RIM_HEIGHT && state.pos.y > RIM_HEIGHT - 0.5) {
      const passThrough = Math.sqrt(state.pos.x * state.pos.x + state.pos.z * state.pos.z) < effectiveRimRadius - BALL_RADIUS * 0.5;
      if (passThrough && state.vel.y < 0) {
        state.shotProcessed = true;
        callbacks.onPassThroughHoop();
        return true;
      }
    }
  }

  // Ball rotation
  const speed = state.vel.length();
  if (speed > 0.1) {
    ball.rotation.x += state.vel.z * dt * 3;
    ball.rotation.z -= state.vel.x * dt * 3;
  }

  ball.position.copy(state.pos);

  // Trail
  if (speed > 1) {
    trailPoints.push({ pos: state.pos.clone(), age: 0 });
    if (trailPoints.length > 30) trailPoints.shift();
  }

  // Settled (miss)
  if (state.pos.y < BALL_RADIUS + 0.1 && speed < 0.3) {
    state.settleTimer += dt;
    if (state.settleTimer > 1.0 && !state.shotProcessed) {
      state.shotProcessed = true;
      callbacks.onSettled();
    }
  }

  // Out of bounds
  if (state.pos.y < -2 || Math.abs(state.pos.x) > 15 || Math.abs(state.pos.z) > 20) {
    if (!state.shotProcessed) {
      state.shotProcessed = true;
      callbacks.onOutOfBounds();
    }
  }

  return true;
}

/**
 * Launch the ball toward the hoop with given power and aim offset.
 */
export function launchBall(
  state: BallPhysicsState,
  power: number,
  aimAngle: number,
): void {
  state.inFlight = true;
  state.shotProcessed = false;
  state.settleTimer = 0;
  state.bounceCount = 0;

  const toHoop = new Vector3(0, RIM_HEIGHT, 0).sub(state.pos);
  const dist = Math.sqrt(toHoop.x * toHoop.x + toHoop.z * toHoop.z);
  const arcAngle = 0.8 + (1 - power) * 0.4;
  const speed = 5 + power * 7 + dist * 0.5;
  const horizDir = new Vector3(toHoop.x, 0, toHoop.z).normalize();
  horizDir.x += aimAngle * 0.3;
  horizDir.normalize();

  state.vel.set(
    horizDir.x * speed * Math.cos(arcAngle),
    speed * Math.sin(arcAngle),
    horizDir.z * speed * Math.cos(arcAngle),
  );
}

// ============================================================
// TRAIL RENDERER
// ============================================================

export class TrailRenderer {
  private segments: Mesh[] = [];
  private scene: Group;
  private maxSegments = 20;

  constructor(scene: Group) {
    this.scene = scene;
    for (let i = 0; i < this.maxSegments; i++) {
      const mesh = new Mesh(
        new SphereGeometry(0.03 + (1 - i / this.maxSegments) * 0.04, 4, 4),
        new MeshBasicMaterial({
          color: 0xff6600,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.segments.push(mesh);
    }
  }

  update(trailPoints: TrailPoint[], dt: number) {
    // Age and remove old points
    for (let i = trailPoints.length - 1; i >= 0; i--) {
      trailPoints[i].age += dt;
      if (trailPoints[i].age > 0.5) trailPoints.splice(i, 1);
    }

    // Update visual segments
    for (let i = 0; i < this.maxSegments; i++) {
      const seg = this.segments[i];
      if (i < trailPoints.length) {
        const pt = trailPoints[trailPoints.length - 1 - i];
        seg.position.copy(pt.pos);
        const alpha = 1 - pt.age / 0.5;
        (seg.material as MeshBasicMaterial).opacity = alpha * 0.4;
        seg.scale.setScalar(alpha * 0.8);
        seg.visible = true;
      } else {
        seg.visible = false;
      }
    }
  }

  setColor(color: number) {
    this.segments.forEach(s => {
      (s.material as MeshBasicMaterial).color.setHex(color);
    });
  }
}

// ============================================================
// SHOT ARC PREVIEW
// ============================================================

export class ArcPreview {
  private dots: Mesh[] = [];
  private scene: Group;
  private dotCount = 15;

  constructor(scene: Group) {
    this.scene = scene;
    const mat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
    });
    for (let i = 0; i < this.dotCount; i++) {
      const dot = new Mesh(new SphereGeometry(0.015, 4, 4), mat.clone());
      dot.visible = false;
      scene.add(dot);
      this.dots.push(dot);
    }
  }

  show(startPos: Vector3, power: number, aimAngle: number) {
    const vel = new Vector3();
    const toHoop = new Vector3(0, RIM_HEIGHT, 0).sub(startPos);
    const dist = Math.sqrt(toHoop.x * toHoop.x + toHoop.z * toHoop.z);
    const arcAngle = 0.8 + (1 - power) * 0.4;
    const speed = 5 + power * 7 + dist * 0.5;
    const horizDir = new Vector3(toHoop.x, 0, toHoop.z).normalize();
    horizDir.x += aimAngle * 0.3;
    horizDir.normalize();
    vel.set(
      horizDir.x * speed * Math.cos(arcAngle),
      speed * Math.sin(arcAngle),
      horizDir.z * speed * Math.cos(arcAngle),
    );

    const pos = startPos.clone();
    const timeStep = 0.08;
    for (let i = 0; i < this.dotCount; i++) {
      pos.x += vel.x * timeStep;
      pos.y += vel.y * timeStep;
      pos.z += vel.z * timeStep;
      vel.y += GRAVITY * timeStep;

      this.dots[i].position.copy(pos);
      const alpha = 0.5 * (1 - i / this.dotCount);
      (this.dots[i].material as MeshBasicMaterial).opacity = alpha;
      this.dots[i].visible = true;
    }
  }

  hide() {
    this.dots.forEach(d => { d.visible = false; });
  }
}
