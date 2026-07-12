// Lily brand mark — a stylised lily bloom, plus wordmark. Defaults to a soft
// violet gradient; pass mono to render flat in currentColor instead (e.g.
// wrap in a text-white parent to sit crisply on a colored badge).
import { useId } from "react";

export function LilyMark({ size = 32, mono = false }: { size?: number; mono?: boolean }) {
  const id = `lily-grad-${useId()}`;
  const fill = mono ? "currentColor" : `url(#${id})`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Lily">
      {!mono && (
        <defs>
          <linearGradient id={id} x1="6" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A855F7" />
            <stop offset="0.55" stopColor="#7C3AED" />
            <stop offset="1" stopColor="#6366F1" />
          </linearGradient>
        </defs>
      )}
      {/* three petals */}
      <path d="M24 6c-3.6 5.2-3.6 11.8 0 17 3.6-5.2 3.6-11.8 0-17Z" fill={fill} />
      <path d="M24 23C18.8 19.4 12.2 19.4 7 23c5.2 3.6 11.8 3.6 17 0Z" fill={fill} opacity="0.92" />
      <path d="M24 23c5.2-3.6 11.8-3.6 17 0-5.2 3.6-11.8 3.6-17 0Z" fill={fill} opacity="0.92" />
      {/* stamen + lower bloom */}
      <path d="M24 22c-2.4 6-2.4 12.5 0 19 2.4-6.5 2.4-13 0-19Z" fill={fill} opacity="0.78" />
      <circle cx="24" cy="22.5" r="2.4" fill={mono ? "currentColor" : "#FFFFFF"} opacity={mono ? "0.55" : "0.9"} />
    </svg>
  );
}

export function LilyLogo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LilyMark size={32} />
      <div className="leading-none">
        <div className="text-[19px] font-semibold tracking-tight text-ink">Lily</div>
        {subtitle && <div className="text-[11px] text-faint mt-0.5">your 24/7 back-office</div>}
      </div>
    </div>
  );
}
