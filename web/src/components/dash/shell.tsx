"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { Wordmark } from "@/components/site/brand";
import { BrandWipe } from "@/components/site/brand-wipe";

const NAV: { href: string; label: string }[] = [
  { href: "/console", label: "Overview" },
  { href: "/console#queue", label: "Queue" },
  { href: "/console#routes", label: "Routes" },
  { href: "/console#cs", label: "CS" },
  { href: "/metrics", label: "Metrics" },
];

export function DashShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="dash flex h-dvh overflow-hidden" data-theme="light">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Alodi home">
              <Wordmark className="text-[24px]" />
            </Link>
            <span className="d-chip hidden md:inline-flex">Binh Thanh hub</span>
          </div>
          <nav className="flex items-center gap-1 rounded-[18px] bg-[#ececec] p-1" aria-label="Dashboard views">
            {NAV.map((n, i) => {
              const here = NAV.findIndex((x) => x.href === path);
              const on = n.href === path;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  transitionTypes={[i > here ? "nav-forward" : "nav-back"]}
                  className={`rounded-[14px] px-3.5 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-white text-[var(--d-text)] shadow-[var(--d-shadow)]" : "text-[var(--d-muted)] hover:text-[var(--d-text)]"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/start" className="d-btn d-btn-secondary d-btn-sm hidden md:inline-flex">
            Open the demo
          </Link>
        </header>
        <main className="d-scroll min-h-0 flex-1 overflow-y-auto">
          <ViewTransition
            enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-rise" }}
            exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-rise" }}
            default="none"
          >
            <div className="mx-auto max-w-[1440px]">{children}</div>
          </ViewTransition>
        </main>
        <BrandWipe />
      </div>
    </div>
  );
}
