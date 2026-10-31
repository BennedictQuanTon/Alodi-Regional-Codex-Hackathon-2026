"use client";

import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { useRef, useState } from "react";

function wrap(min: number, max: number, v: number) {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
}

/**
 * Infinite marquee whose speed follows scroll velocity and whose direction flips with scroll
 * direction. Hovering slows it to a crawl. Children are rendered twice for a seamless loop.
 */
export function VelocityMarquee({
  children,
  speed = 40,
  reverse = false,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
  const x = useTransform(base, (v) => `${wrap(-50, 0, v)}%`);
  const dir = useRef(reverse ? 1 : -1);
  const [hover, setHover] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const visible = useInView(track);

  useAnimationFrame((_, delta) => {
    if (reduce || !visible || !track.current) return;
    const width = track.current.scrollWidth / 2 || 1;
    const f = factor.get();
    const initial = reverse ? 1 : -1;
    if (f > 0.02) dir.current = initial;
    else if (f < -0.02) dir.current = -initial;
    const move = dir.current * (speed / width) * 50 * (delta / 1000) * (1 + Math.abs(f));
    base.set(base.get() + move * (hover ? 0.15 : 1));
  });

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.div ref={track} className="flex w-max" style={{ x }}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
