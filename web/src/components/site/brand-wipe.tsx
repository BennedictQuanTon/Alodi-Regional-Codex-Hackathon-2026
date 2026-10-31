"use client";

import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// The one big transition: the first time someone enters the product in a session, the logo builds itself on navy,
// then its ring opens and the page is revealed through it. Everything after that is a quiet cross-fade.
const KEY = "alodi-intro-played";
const EASE = [0.22, 1, 0.36, 1] as const;
const BARS = [
  { x: 8.55, y: 10.25, h: 3.5 },
  { x: 11.25, y: 8.9, h: 6.2 },
  { x: 13.95, y: 10.25, h: 3.5 },
];

function alreadyPlayed() {
  try {
    if (sessionStorage.getItem(KEY)) return true;
    sessionStorage.setItem(KEY, "1");
  } catch {}
  return false;
}

export function BrandWipe() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const r = useMotionValue(0);
  // the page opens from the centre of the logo's "o"
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const o = useRef<HTMLSpanElement>(null);
  const mask = useMotionTemplate`radial-gradient(circle at ${cx}px ${cy}px, transparent ${r}px, #000 calc(${r}px + 1px))`;
  const ringOpacity = useTransform(r, (v) => (v > 0 ? 1 : 0));
  const ringStroke = useMotionTemplate`calc(${r}px * 2)`;

  useLayoutEffect(() => {
    if (reduce || alreadyPlayed()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot intro on first mount
    setShow(true);
  }, [reduce]);

  useEffect(() => {
    if (!show) return;
    const box = o.current?.getBoundingClientRect();
    if (box) {
      cx.set(box.left + box.width / 2);
      cy.set(box.top + box.height / 2);
    }
    const far = Math.hypot(window.innerWidth, window.innerHeight);
    const open = animate(r, far, { delay: 1.15, duration: 0.75, ease: [0.76, 0, 0.24, 1] });
    const done = setTimeout(() => setShow(false), 1950);
    return () => {
      open.stop();
      clearTimeout(done);
    };
  }, [show, r, cx, cy]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden" aria-hidden onClick={() => setShow(false)}>
      <motion.div className="absolute inset-0 grid place-items-center bg-navy" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <motion.div
          className="inline-flex items-baseline font-[family-name:var(--font-logo)] text-[clamp(72px,10vw,148px)] font-extrabold leading-none tracking-[-0.03em] text-white"
          animate={{ opacity: [1, 1, 0] }}
          transition={{ duration: 1.3, times: [0, 0.86, 1] }}
        >
          <motion.span initial={{ opacity: 0, x: "0.5em" }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.55, ease: EASE }}>
            al
          </motion.span>
          <span ref={o} className="relative mx-[0.02em] inline-block w-[0.66em] self-center translate-y-[0.07em]">
            <svg viewBox="0 0 24 24" className="h-auto w-full overflow-visible">
              <motion.circle
                cx="12"
                cy="12"
                r="8.6"
                fill="none"
                stroke="#f05a00"
                strokeWidth="5.4"
                transform="rotate(-90 12 12)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
              />
              {BARS.map((b, i) => (
                <motion.rect
                  key={b.x}
                  x={b.x}
                  y={b.y}
                  width="1.5"
                  height={b.h}
                  rx="0.75"
                  fill="#fff"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.3 + i * 0.07, type: "spring", stiffness: 420, damping: 16 }}
                />
              ))}
            </svg>
          </span>
          <motion.span initial={{ opacity: 0, x: "-0.5em" }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.55, ease: EASE }}>
            di
          </motion.span>
        </motion.div>
      </motion.div>
      {/* the brand ring travels on the edge of the opening */}
      <motion.div
        className="absolute rounded-full border-[18px] border-orange"
        style={{ left: cx, top: cy, x: "-50%", y: "-50%", width: ringStroke, height: ringStroke, boxSizing: "content-box", opacity: ringOpacity }}
      />
    </div>
  );
}
