"use client";

import { motion } from "motion/react";
import { ViewTransition, useEffect, useRef, useState } from "react";
import { BrandWipe } from "@/components/site/brand-wipe";
import { useDemo } from "@/lib/demo/engine";
import { BuyerPhone } from "./buyer-phone";
import { ConsolePanel } from "./console-parts";
import { DemoNav, Director, useLocalFlag } from "./director";
import { PhoneFrame } from "./phone";
import { ShipperApp } from "./shipper-app";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Scale fixed-size content to fit the frame (so screen recordings work at any resolution). */
export function useFit(baseW: number, baseH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setScale(Math.min(1.25, width / baseW, height / baseH));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseW, baseH]);
  return { ref, scale };
}

/** Dashboard-style entrance: each column rises out of a soft blur, one after another. */
export function Enter({ i, children, className = "" }: { i: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 text-center text-[13px] font-medium text-[var(--ui-muted)]">{children}</div>;
}

export function DemoStage() {
  const { state, engine } = useDemo();
  const [captions, setCaptions] = useLocalFlag("alodi-captions", true);
  const BASE_W = 1720;
  const BASE_H = 880;
  const { ref, scale } = useFit(BASE_W, BASE_H);
  const callOn = state.call.status === "ringing" || state.call.status === "connected";

  return (
    <div className="ui flex h-dvh flex-col overflow-hidden">
      <DemoNav />
      <div ref={ref} className="relative flex-1 overflow-hidden">
        <div
          className="absolute left-1/2 top-[46%] flex items-start gap-10 px-14"
          style={{ width: BASE_W, height: BASE_H - 120, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
        >
          <Enter i={0}>
            <Label>Shipper</Label>
            <ViewTransition name="phone-shipper" share="morph" default="none">
              <PhoneFrame clock={state.clock}>
                <ShipperApp state={state} engine={engine} />
              </PhoneFrame>
            </ViewTransition>
          </Enter>
          <Enter i={1}>
            <Label>Buyer</Label>
            <ViewTransition name="phone-buyer" share="morph" default="none">
              <PhoneFrame clock={state.clock} dark={callOn}>
                <BuyerPhone state={state} engine={engine} />
              </PhoneFrame>
            </ViewTransition>
          </Enter>
          <Enter i={2} className="flex h-full flex-1 flex-col">
            <Label>Operations</Label>
            <ViewTransition name="panel-console" share="morph" default="none">
              <div className="h-[704px]">
                <ConsolePanel state={state} engine={engine} />
              </div>
            </ViewTransition>
          </Enter>
        </div>
        <Director captions={captions} setCaptions={setCaptions} />
      </div>
      <BrandWipe id="demo" tagline="One call. Delivered." />
    </div>
  );
}
