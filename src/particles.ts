// ============================================================
// PARTICLES — celebration, sparks, effects
// ============================================================

import {
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  Group,
  AdditiveBlending,
} from '@iwsdk/core';
import { type Particle, MAX_PARTICLES, GRAVITY } from './types';

export class ParticleSystem {
  private particles: Particle[] = [];
  private scene: Group;

  constructor(scene: Group) {
    this.scene = scene;
  }

  spawn(pos: Vector3, count: number, color: number) {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const mesh = new Mesh(
        new SphereGeometry(0.02, 4, 4),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.particles.push({
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

  /** Enhanced burst for big moments (streaks, achievements) */
  burstRing(pos: Vector3, count: number, color: number, speed = 5) {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = (i / count) * Math.PI * 2;
      const mesh = new Mesh(
        new SphereGeometry(0.025, 4, 4),
        new MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          blending: AdditiveBlending,
        }),
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new Vector3(
          Math.cos(angle) * speed,
          Math.random() * 2 + 1,
          Math.sin(angle) * speed,
        ),
        life: 0,
        maxLife: 1.0 + Math.random() * 0.3,
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vel.y += GRAVITY * 0.5 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha * 0.8;
      p.mesh.scale.setScalar(alpha);
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  clear() {
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles.length = 0;
  }
}
