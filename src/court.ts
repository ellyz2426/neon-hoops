// ============================================================
// COURT & ENVIRONMENT — geometry, hoop, lighting, holodeck
// ============================================================

import {
  World,
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
  Fog,
  AmbientLight,
  PointLight,
  DirectionalLight,
  EdgesGeometry,
  LineSegments,
  AdditiveBlending,
} from '@iwsdk/core';
import {
  RIM_HEIGHT, RIM_RADIUS, BACKBOARD_WIDTH, BACKBOARD_HEIGHT,
  FREE_THROW_DIST, THREE_POINT_DIST, HALF_COURT_DIST,
  BALL_RADIUS, THEMES, BALL_SKINS,
  type CourtTheme, type BallSkin,
} from './types';

export interface CourtAssets {
  courtFloor: Mesh;
  gridMat: MeshBasicMaterial;
  courtLinesMat: MeshBasicMaterial;
  bbMat: MeshStandardMaterial;
  rimMat: MeshStandardMaterial;
  rimMesh: Mesh;
  netGroup: Group;
  accentLights: PointLight[];
  ball: Mesh;
  ballGlow: Mesh;
  ballMat: MeshStandardMaterial;
  shotMarker: Mesh;
  markerMat: MeshBasicMaterial;
  decoShapes: Mesh[];
  ambientParticles: { mesh: Mesh; baseY: number; phase: number }[];
}

export function buildCourt(world: World): CourtAssets {
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

  // Three-point arc
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

  // ---- BACKBOARD ----
  const bbMat = new MeshStandardMaterial({
    color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 0.15,
    transparent: true, opacity: 0.4, metalness: 0.8, roughness: 0.2,
  });
  const backboard = new Mesh(new BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, 0.04), bbMat);
  backboard.position.set(0, RIM_HEIGHT + BACKBOARD_HEIGHT / 2 - 0.1, -0.15);
  world.scene.add(backboard);

  const bbEdges = new LineSegments(
    new EdgesGeometry(new BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, 0.04)),
    new LineBasicMaterial({ color: 0x00ccff }),
  );
  bbEdges.position.copy(backboard.position);
  world.scene.add(bbEdges);

  const innerSquare = new LineSegments(
    new EdgesGeometry(new BoxGeometry(0.6, 0.45, 0.06)),
    new LineBasicMaterial({ color: 0x00ccff }),
  );
  innerSquare.position.set(0, RIM_HEIGHT + 0.15, -0.12);
  world.scene.add(innerSquare);

  // ---- RIM ----
  const rimMat = new MeshStandardMaterial({
    color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.3,
  });
  const rim = new Mesh(new TorusGeometry(RIM_RADIUS, 0.015, 8, 32), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_HEIGHT, 0);
  world.scene.add(rim);

  const rimSupport = new Mesh(new CylinderGeometry(0.015, 0.015, 0.2, 6), rimMat);
  rimSupport.rotation.x = Math.PI / 2;
  rimSupport.position.set(0, RIM_HEIGHT, -RIM_RADIUS);
  world.scene.add(rimSupport);

  // ---- NET ----
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

  // ---- POLE ----
  const pole = new Mesh(
    new CylinderGeometry(0.06, 0.08, RIM_HEIGHT + 0.5, 8),
    new MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 }),
  );
  pole.position.set(0, (RIM_HEIGHT + 0.5) / 2, -0.5);
  world.scene.add(pole);

  // ---- BASKETBALL ----
  const ballMat = new MeshStandardMaterial({
    color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.2, metalness: 0.2, roughness: 0.6,
  });
  const ball = new Mesh(new SphereGeometry(BALL_RADIUS, 16, 16), ballMat);
  ball.position.set(0, 1.2, FREE_THROW_DIST);
  world.scene.add(ball);

  const ballGlow = new Mesh(
    new SphereGeometry(BALL_RADIUS * 1.4, 8, 8),
    new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.15, blending: AdditiveBlending }),
  );
  ball.add(ballGlow);

  const seamGeo = new EdgesGeometry(new SphereGeometry(BALL_RADIUS * 1.01, 4, 2));
  const seamLines = new LineSegments(seamGeo, new LineBasicMaterial({ color: 0x331100, transparent: true, opacity: 0.5 }));
  ball.add(seamLines);

  // ---- LIGHTING ----
  world.scene.add(new AmbientLight(0x222244, 0.4) as any);
  const mainLight = new DirectionalLight(0xffffff, 0.6);
  mainLight.position.set(5, 10, 5);
  world.scene.add(mainLight as any);

  const accentLights: PointLight[] = [];
  ([[0, 6, 0], [-5, 5, 5], [5, 5, 5], [0, 5, -3]] as [number, number, number][]).forEach(([x, y, z]) => {
    const light = new PointLight(0xff6600, 0.5, 20);
    light.position.set(x, y, z);
    world.scene.add(light as any);
    accentLights.push(light);
  });

  const hoopLight = new PointLight(0xff4400, 1.0, 8);
  hoopLight.position.set(0, RIM_HEIGHT + 2, 0);
  world.scene.add(hoopLight as any);

  world.scene.fog = new Fog(0x000811, 5, 35);

  // ---- WIREFRAME DECORATIONS ----
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

  // ---- AMBIENT PARTICLES ----
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

  // ---- SHOT MARKER ----
  const markerMat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.4 });
  const shotMarker = new Mesh(new RingGeometry(0.3, 0.5, 16), markerMat);
  shotMarker.rotation.x = -Math.PI / 2;
  shotMarker.position.set(0, 0.02, FREE_THROW_DIST);
  world.scene.add(shotMarker);

  return {
    courtFloor, gridMat, courtLinesMat, bbMat, rimMat, rimMesh: rim,
    netGroup, accentLights, ball, ballGlow, ballMat,
    shotMarker, markerMat, decoShapes, ambientParticles,
  };
}

export function applyTheme(assets: CourtAssets, theme: CourtTheme, fog: Fog | null) {
  assets.courtFloor.material = new MeshStandardMaterial({ color: theme.court, metalness: 0.3, roughness: 0.7 });
  assets.courtLinesMat.color.setHex(theme.lines);
  assets.rimMat.color.setHex(theme.rim);
  assets.rimMat.emissive.setHex(theme.rim);
  assets.bbMat.color.setHex(theme.backboard);
  assets.bbMat.emissive.setHex(theme.backboard);
  if (fog) fog.color.setHex(theme.fog);
  assets.accentLights.forEach(l => l.color.setHex(theme.accent));
  assets.gridMat.color.setHex(theme.lines);
}

export function applyBallSkin(assets: CourtAssets, skin: BallSkin) {
  assets.ballMat.color.setHex(skin.color);
  assets.ballMat.emissive.setHex(skin.emissive);
  assets.ballMat.emissiveIntensity = skin.emissiveIntensity;
  (assets.ballGlow.material as MeshBasicMaterial).color.setHex(skin.glowColor);
  (assets.ballGlow.material as MeshBasicMaterial).opacity = skin.glowOpacity;
}

/** Animate net rings (called on a make) */
export function animateNet(netGroup: Group, elapsedTime: number, intensity = 1.0) {
  netGroup.children.forEach((ring, i) => {
    const t = elapsedTime * 8;
    const wave = Math.sin(t - i * 0.8) * 0.03 * intensity;
    ring.position.x = wave;
    ring.position.z = Math.cos(t - i * 1.2) * 0.02 * intensity;
  });
}

export function updateEnvironmentAnimations(
  assets: CourtAssets,
  elapsedTime: number,
  dt: number,
) {
  // Decorations
  assets.decoShapes.forEach((d, i) => {
    d.rotation.x += dt * 0.2 * (i % 2 === 0 ? 1 : -1);
    d.rotation.y += dt * 0.3;
    d.position.y += Math.sin(elapsedTime * 0.5 + i) * dt * 0.1;
  });

  // Ambient particles
  assets.ambientParticles.forEach(p => {
    p.mesh.position.y = p.baseY + Math.sin(elapsedTime + p.phase) * 0.2;
    (p.mesh.material as MeshBasicMaterial).opacity = 0.2 + Math.sin(elapsedTime * 2 + p.phase) * 0.1;
  });

  // Rim glow
  assets.rimMat.emissiveIntensity = 0.3 + Math.sin(elapsedTime * 2) * 0.1;

  // Shot marker pulse
  assets.shotMarker.scale.setScalar(1 + Math.sin(elapsedTime * 3) * 0.1);
  (assets.shotMarker.material as MeshBasicMaterial).opacity = 0.3 + Math.sin(elapsedTime * 2) * 0.1;
}
