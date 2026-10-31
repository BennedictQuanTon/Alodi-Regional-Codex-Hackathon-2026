"use client";

import Lenis from "lenis";
import { animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Lenis smooth scrolling for the long editorial pages. Keeps position: sticky working. */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  useEffect(() => {
    // low-core machines keep the browser's own scrolling, which stays smooth under load
    if (reduce || navigator.hardwareConcurrency <= 4) return;
    const lenis = new Lenis({ duration: 1.15, anchors: { offset: -96 }, easing: (t) => 1 - Math.pow(1 - t, 4) });
    let id = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [reduce]);
  return null;
}

/** Looping SVG animations repaint even off screen, so each one only runs while it is visible. */
export function PauseOffscreen() {
  useEffect(() => {
    const svgs = [...document.querySelectorAll("main svg")].filter((s) => s.querySelector("animate, animateMotion")) as SVGSVGElement[];
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const s = e.target as SVGSVGElement;
        if (e.isIntersecting) s.unpauseAnimations();
        else s.pauseAnimations();
      }
    });
    svgs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return null;
}

/** Thin orange reading-progress line pinned to the top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = scrollYProgress;
  return <motion.div className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-orange" style={{ scaleX: x }} aria-hidden />;
}

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

/**
 * Editorial headline reveal: each word rises out of its own masked line.
 * Pass plain text; the accessible name stays the full sentence.
 */
export function RevealText({
  text,
  as = "h2",
  className = "",
  delay = 0,
  stagger = 0.045,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const Tag = as;
  const words = text.split(" ");
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-top" aria-hidden>
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: "105%", rotate: 4 }}
            animate={inView || reduce ? { y: "0%", rotate: 0 } : undefined}
            transition={{ duration: 0.9, delay: delay + i * stagger, ease: EASE }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </Tag>
  );
}

/** Scroll-linked drift: moves children by `amount` px across their pass through the viewport. */
export function Parallax({ children, amount = 60, className = "" }: { children: React.ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y }}>
      {children}
    </motion.div>
  );
}

/** Counts up every number in a string such as "₫40,000", "8–12%", "+34.75%" when scrolled into view. */
export function Figure({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, 1, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setP });
    return () => c.stop();
  }, [inView, reduce]);

  const prog = reduce ? 1 : p;
  const text = value.replace(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/g, (m) => {
    const thousands = m.includes(",");
    const decimals = !thousands && m.includes(".") ? m.split(".")[1].length : 0;
    const n = parseFloat(m.replace(/,/g, ""));
    const cur = n * prog;
    if (thousands) return Math.round(cur).toLocaleString("en-US");
    return decimals ? cur.toFixed(decimals) : String(Math.round(cur));
  });

  return (
    <span ref={ref} className={className} aria-label={value}>
      {text}
    </span>
  );
}

/** 0→1 progress when scrolled into view (chart grow-in). */
export function useGrow() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, 1, { duration: 1.2, ease: EASE, onUpdate: setP });
    return () => c.stop();
  }, [inView, reduce]);
  return { ref, p: reduce ? 1 : p };
}
