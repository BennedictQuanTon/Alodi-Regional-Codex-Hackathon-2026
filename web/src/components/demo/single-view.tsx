"use client";

import { ViewTransition, useEffect, useState } from "react";
import { BrandWipe } from "@/components/site/brand-wipe";
import { useDemo } from "@/lib/demo/engine";
import { BuyerPhone } from "./buyer-phone";
import { ConsolePanel } from "./console-parts";
import { DemoNav, Director } from "./director";
import { PhoneFrame } from "./phone";
import { ShipperApp } from "./shipper-app";
import { Enter, useFit } from "./stage";

/**
 * One screen per window for recording. Tabs stay in sync over BroadcastChannel.
 * Press H to hide the nav and dock for a clean frame.
 */
export function SingleView({ view }: { view: "shipper" | "buyer" | "console" }) {
  const { state, engine } = useDemo();
  const [chrome, setChrome] = useState(true);
  const phone = view !== "console";
  const W = phone ? 380 : 980;
  const H = phone ? 820 : 860;
  const { ref, scale } = useFit(W, H);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "h") setChrome((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="ui flex h-dvh flex-col overflow-hidden">
      {chrome && <DemoNav />}
      <div ref={ref} className="relative flex-1 overflow-hidden">
        <div className="absolute left-1/2 top-[45%] flex justify-center" style={{ width: W, height: H - 90, transform: `translate(-50%, -50%) scale(${scale})` }}>
          <Enter i={0} className={phone ? "" : "h-full w-full"}>
            {view === "shipper" && (
              <ViewTransition name="phone-shipper" share="morph" default="none">
                <PhoneFrame clock={state.clock}>
                  <ShipperApp state={state} engine={engine} />
                </PhoneFrame>
              </ViewTransition>
            )}
            {view === "buyer" && (
              <ViewTransition name="phone-buyer" share="morph" default="none">
                <PhoneFrame clock={state.clock} dark={state.call.status === "ringing" || state.call.status === "connected"}>
                  <BuyerPhone state={state} engine={engine} />
                </PhoneFrame>
              </ViewTransition>
            )}
            {view === "console" && (
              <ViewTransition name="panel-console" share="morph" default="none">
                <div className="h-full">
                  <ConsolePanel state={state} engine={engine} />
                </div>
              </ViewTransition>
            )}
          </Enter>
        </div>
        {chrome ? <Director /> : <div className="absolute bottom-3 right-4 text-[11px] ui-muted opacity-60">H shows controls</div>}
      </div>
      <BrandWipe />
    </div>
  );
}
