"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { BrandWipe } from "@/components/site/brand-wipe";
import { Wordmark } from "@/components/site/brand";

type Theme = "light" | "dark";
const KEY = "alodi-dash-theme";
const EVT = "alodi-dash-theme";

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}
function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useDashTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const set = (t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    window.dispatchEvent(new Event(EVT));
  };
  return [theme, set] as const;
}

const NAV: { href: string; label: string }[] = [
  { href: "/console", label: "Hub overview" },
  { href: "/console#queue", label: "Exception queue" },
  { href: "/console#routes", label: "Routes" },
  { href: "/console#cs", label: "CS queue" },
  { href: "/metrics", label: "Metrics" },
  { href: "/demo", label: "Demo stage" },
  { href: "/script", label: "Demo script" },
];

/** Theme switch with a circular reveal that grows from the clicked button. */
function ThemeToggle() {
  const [theme, setTheme] = useDashTheme();
  const swap = (t: Theme, e: React.MouseEvent) => {
    if (t === theme) return;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setTheme(t);
    const x = e.clientX;
    const y = e.clientY;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add("theme-vt");
    const vt = doc.startViewTransition(() => flushSync(() => setTheme(t)));
    vt.ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    );
    vt.finished.finally(() => document.documentElement.classList.remove("theme-vt"));
  };
  return (
    <div className="flex items-center rounded-full border border-[var(--d-border)] p-0.5" role="group" aria-label="Colour mode">
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          onClick={(e) => swap(t, e)}
          aria-pressed={theme === t}
          className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize transition ${
            theme === t ? "bg-[var(--d-primary)] text-white" : "text-[var(--d-text-2)] hover:bg-[var(--d-raised)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function DashShell({ children, reviewCount = 116 }: { children: React.ReactNode; reviewCount?: number }) {
  const [theme] = useDashTheme();
  const path = usePathname();

  return (
    <div className="dash flex h-dvh overflow-hidden" data-theme={theme}>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--d-border)] bg-[var(--d-side)] lg:flex" style={{ viewTransitionName: "dash-side" }}>
        <div className="px-6 pb-6 pt-7">
          <Link href="/" aria-label="Alodi home">
            <Wordmark className="text-[28px]" tone={theme === "dark" ? "light" : "navy"} />
          </Link>
          <div className="mt-1.5 text-[13px] d-muted">Operations · Binh Thanh hub</div>
        </div>
        <nav className="mt-2 flex flex-col">
          {NAV.map((n, i) => {
            const active = n.href === path;
            const here = NAV.findIndex((x) => x.href === path);
            return (
              <Link
                key={n.href}
                href={n.href}
                transitionTypes={[i > here ? "nav-forward" : "nav-back"]}
                className={`relative px-6 py-3 text-[15px] transition ${
                  active ? "bg-[var(--d-primary-soft)] font-semibold text-[var(--d-primary)]" : "text-[var(--d-text-2)] hover:bg-[var(--d-raised)]"
                }`}
              >
                {active && <span className="absolute inset-y-0 right-0 w-[3px] bg-[var(--d-primary)]" />}
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-5 px-6 pb-7">
          <Link href="/start" className="d-btn d-btn-primary w-full">
            Open the demo
          </Link>
          <div className="space-y-3 text-[14px] d-text2">
            <div>Settings</div>
            <div>Support</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-[var(--d-border)] px-5 md:px-8">
          <Link href="/" className="lg:hidden" aria-label="Alodi home">
            <Wordmark className="text-[22px]" tone={theme === "dark" ? "light" : "navy"} />
          </Link>
          <input
            placeholder="Search tracking ID, buyer, district…"
            className="d-input hidden h-10 w-[300px] px-4 text-[14px] placeholder:text-[var(--d-muted)] md:block"
          />
          <nav className="flex gap-3 text-[13px] lg:hidden">
            <Link href="/console" className={path === "/console" ? "font-semibold text-[var(--d-primary)]" : "d-text2"}>
              Overview
            </Link>
            <Link href="/metrics" className={path === "/metrics" ? "font-semibold text-[var(--d-primary)]" : "d-text2"}>
              Metrics
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden sm:inline-flex">
              <span className="d-chip d-chip-warn">
                <span className="size-1.5 rounded-full bg-[var(--d-accent)]" aria-hidden />
                {reviewCount} with CS
              </span>
            </span>
            <span className="grid size-9 place-items-center rounded-full border-2 border-[var(--d-surface)] bg-[var(--d-primary)] text-[13px] font-semibold text-white" title="Long Quan Ton">
              LT
            </span>
          </div>
        </header>
        <main className="d-scroll min-h-0 flex-1 overflow-y-auto">
          <ViewTransition
            enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-rise" }}
            exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-rise" }}
            default="none"
          >
            <div>{children}</div>
          </ViewTransition>
        </main>
        <BrandWipe id="dash" tagline="Operations, live." />
      </div>
    </div>
  );
}
