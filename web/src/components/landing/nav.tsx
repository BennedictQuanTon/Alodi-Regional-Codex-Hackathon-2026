"use client";

import Link from "next/link";
import { LIVE_DEMO_URL } from "@/lib/content";
import { useEffect, useState } from "react";
import { Chevron, LogoLink } from "@/components/site/brand";

const LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#product", label: "Architecture" },
  { href: "#how-it-works", label: "Product" },
  { href: "#tech", label: "OpenAI" },
  { href: "#team", label: "Team" },
];

export function AnnouncementBar() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="bg-black text-parchment">
      <div className="relative flex min-h-[62px] items-center justify-center gap-4 px-12 py-3 text-[16px]">
        <span className="text-center">MVP demo on 31 October. Three screens, one rescue, all mock data.</span>
        <Link
          href="/script"
          className="hidden shrink-0 rounded-full bg-parchment px-4 py-2 text-[12px] uppercase text-black transition hover:bg-white sm:inline-flex"
        >
          Read the script
        </Link>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close announcement"
          className="absolute right-6 text-[22px] leading-none opacity-80 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-300 ${scrolled ? "bg-parchment/95" : ""}`}>
      <div className={`container-page flex items-center justify-between gap-6 transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${scrolled ? "h-[84px]" : "h-[120px]"}`}>
        <div className="flex items-center gap-10">
          <LogoLink size="text-[34px]" />
          <nav className="hidden items-center gap-8 xl:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-[14px] font-medium uppercase tracking-[0.06em] hover:text-orange-deep">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/console" className="btn btn-dark">
            Dashboard <Chevron />
          </Link>
          <a href={LIVE_DEMO_URL} className="btn btn-primary">
            Watch demo <Chevron />
          </a>
        </div>
        <button
          className="rounded-full border border-navy px-5 py-2 text-[14px] uppercase md:hidden"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-controls="mobile-menu"
        >
          {menu ? "Close" : "Menu"}
        </button>
      </div>
      {menu && (
        <div id="mobile-menu" className="container-page flex flex-col gap-1 border-t border-ash bg-parchment pb-6 pt-3 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenu(false)} className="py-2 text-[16px] uppercase">
              {l.label}
            </a>
          ))}
          <a href={LIVE_DEMO_URL} className="btn btn-primary mt-3">
            Watch demo <Chevron />
          </a>
        </div>
      )}
    </header>
  );
}
