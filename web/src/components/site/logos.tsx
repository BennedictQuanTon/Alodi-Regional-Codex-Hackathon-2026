"use client";

import {
  siApachekafka,
  siAsterisk,
  siCaddy,
  siDocker,
  siFastapi,
  siFramer,
  siGrafana,
  siHuggingface,
  siKubernetes,
  siLanggraph,
  siMinio,
  siNextdotjs,
  siNvidia,
  siOllama,
  siOpenai,
  siPostgresql,
  siPydantic,
  siRedis,
  siShopee,
  siSqlite,
  siTailwindcss,
  siTemporal,
  siTypescript,
  siZalo,
  type SimpleIcon,
} from "simple-icons";

const ICONS: Record<string, SimpleIcon> = {
  siApachekafka,
  siAsterisk,
  siCaddy,
  siDocker,
  siFastapi,
  siFramer,
  siGrafana,
  siHuggingface,
  siKubernetes,
  siLanggraph,
  siMinio,
  siNextdotjs,
  siNvidia,
  siOllama,
  siOpenai,
  siPostgresql,
  siPydantic,
  siRedis,
  siShopee,
  siSqlite,
  siTailwindcss,
  siTemporal,
  siTypescript,
  siZalo,
};

/** A real technology logo: simple-icons glyph in its brand colour, or an image from /public/logos. */
export function TechIcon({ icon, size = 24, mono = false, className = "" }: { icon: string; size?: number; mono?: boolean; className?: string }) {
  const s = ICONS[icon];
  if (s) {
    const dark = ["000000", "1C3C3C", "231F20", "191919"].includes(s.hex.toUpperCase());
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={`shrink-0 ${className}`} role="img" aria-label={s.title}>
        <path d={s.path} fill={mono ? "currentColor" : dark ? "var(--color-navy)" : `#${s.hex}`} />
      </svg>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon} alt="" width={size} height={size} className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />;
}

/**
 * Source logo for the "built on public figures" strip, shown in the company's own colours.
 * `mono` artwork (white wordmarks made for dark backgrounds) is drawn as a navy silhouette instead.
 */
export function SourceLogo({ name, src, ratio, height = 34, mono = false }: { name: string; src: string; ratio: number; height?: number; mono?: boolean }) {
  if (ICONS[src]) {
    return (
      <span className="flex items-center gap-2.5 transition-transform duration-300 hover:scale-105" style={{ height }} aria-label={name} role="img">
        <TechIcon icon={src} size={height * 0.92} />
        <span className="font-[family-name:var(--font-logo)] text-[27px] font-extrabold tracking-[-0.03em] leading-none" style={{ color: `#${ICONS[src].hex}` }}>
          {name}
        </span>
      </span>
    );
  }
  const w = height * ratio;
  if (mono) {
    return (
      <span
        className="block shrink-0 bg-navy transition-transform duration-300 hover:scale-105"
        style={{
          width: w,
          height,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
        role="img"
        aria-label={name}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className="block shrink-0 object-contain transition-transform duration-300 hover:scale-105" style={{ width: w, height }} />;
}
