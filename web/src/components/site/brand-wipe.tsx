"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// Plays once per area per page session (module memory survives client navigations, resets on reload).
const played = new Set<string>();

/**
 * Scene cut from the branding sheet: the dot blinks on navy, the orange ring expands,
 * orange fills the frame, then the page is revealed through a closing circle.
 */
export function BrandWipe({ tagline = "Make the second drop land.", id = "default" }: { tagline?: string; id?: string }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (played.has(id) || reduce) return;
    played.add(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot intro on first mount
    setShow(true);
  }, [reduce, id]);

  // Separate effect so a StrictMode remount re-arms the timer instead of leaving the overlay up.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 2300);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-hidden bg-navy"
          onClick={() => setShow(false)}
          exit={{ clipPath: "circle(0% at 50% 50%)" }}
          initial={{ clipPath: "circle(150% at 50% 50%)" }}
          animate={{ clipPath: "circle(150% at 50% 50%)" }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden
        >
          {/* 1 · dot blinks */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="rounded-full border-orange"
              initial={{ width: 44, height: 44, borderWidth: 10, opacity: 0 }}
              animate={{
                width: [44, 44, 44, 260, 2600],
                height: [44, 44, 44, 260, 2600],
                borderWidth: [10, 10, 10, 70, 1300],
                opacity: [0, 1, 1, 1, 1],
              }}
              transition={{ duration: 1.7, times: [0, 0.12, 0.42, 0.7, 1], ease: [0.76, 0, 0.24, 1] }}
              style={{ borderStyle: "solid", transform: "translate(-50%, -50%)", position: "absolute", left: 0, top: 0 }}
            />
            <motion.span
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-parchment"
              animate={{ opacity: [0, 1, 0.2, 1, 0.2, 1, 1], backgroundColor: ["#f6f3f1", "#f6f3f1", "#f6f3f1", "#f6f3f1", "#f6f3f1", "#f6f3f1", "#121a2c"] }}
              transition={{ duration: 1.9, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.9] }}
            />
          </div>
          {/* 3 · orange fill with the line */}
          <motion.div
            className="absolute inset-x-0 bottom-[18%] text-center font-[family-name:var(--font-logo)] text-[clamp(22px,3vw,34px)] font-extrabold tracking-[-0.02em] text-ink"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: [0, 0, 1], y: [16, 16, 0] }}
            transition={{ duration: 2, times: [0, 0.78, 1] }}
          >
            {tagline}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
