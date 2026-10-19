"use client";

import { useEffect, useState, type CSSProperties } from "react";

const PARTICLE_COUNT = 24;
const COLORS = ["var(--color-accent)", "var(--color-amber)", "var(--color-brand)", "var(--color-accent-hover)"];
const LIFETIME_MS = 1400;

type Particle = {
  id: number;
  left: string;
  tx: string;
  ty: string;
  rot: string;
  delay: string;
  color: string;
  size: number;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, id) => {
    const angle = randomBetween(-110, -70) * (Math.PI / 180); // mostly upward fan
    const distance = randomBetween(90, 220);
    return {
      id,
      left: `${randomBetween(38, 62)}%`,
      tx: `${Math.cos(angle) * distance}px`,
      ty: `${Math.sin(angle) * distance}px`,
      rot: `${randomBetween(-240, 240)}deg`,
      delay: `${randomBetween(0, 120)}ms`,
      color: COLORS[id % COLORS.length],
      size: randomBetween(6, 11),
    };
  });
}

// Plays once on mount, then removes itself from the DOM. Particles are only
// generated client-side (after mount, via useEffect) rather than during the
// initial render, so there's nothing random to mismatch between server and
// client — SSR/first paint render nothing, the burst plays entirely
// post-hydration. Pure CSS keyframe animation (not JS-driven), so the app's
// existing global prefers-reduced-motion rule already covers it.
export function ConfettiBurst() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Particles must only ever be generated client-side (random values
    // would mismatch between server and client otherwise), so this can't
    // be restructured into a lazy useState initializer without breaking
    // hydration safety — same precedent as theme-toggle.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticles(createParticles());
    const timeout = setTimeout(() => setParticles([]), LIFETIME_MS + 200);
    return () => clearTimeout(timeout);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute top-1/3 rounded-sm"
          style={{
            left: particle.left,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            animation: `confetti-burst ${LIFETIME_MS}ms ease-out ${particle.delay} both`,
            "--tx": particle.tx,
            "--ty": particle.ty,
            "--rot": particle.rot,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
