// Lily brand mark — a stylised lily bloom in a soft violet gradient, plus wordmark.

export function LilyMark({ size = 32 }: { size?: number }) {
  const id = "lily-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Lily">
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A855F7" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      {/* three petals */}
      <path
        d="M24 6c-3.6 5.2-3.6 11.8 0 17 3.6-5.2 3.6-11.8 0-17Z"
        fill={`url(#${id})`}
      />
      <path
        d="M24 23C18.8 19.4 12.2 19.4 7 23c5.2 3.6 11.8 3.6 17 0Z"
        fill={`url(#${id})`}
        opacity="0.92"
      />
      <path
        d="M24 23c5.2-3.6 11.8-3.6 17 0-5.2 3.6-11.8 3.6-17 0Z"
        fill={`url(#${id})`}
        opacity="0.92"
      />
      {/* stamen + lower bloom */}
      <path
        d="M24 22c-2.4 6-2.4 12.5 0 19 2.4-6.5 2.4-13 0-19Z"
        fill={`url(#${id})`}
        opacity="0.78"
      />
      <circle cx="24" cy="22.5" r="2.4" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

export function LilyLogo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LilyMark size={32} />
      <div className="leading-none">
        <div className="text-[19px] font-semibold tracking-tight text-white">Lily</div>
        {subtitle && <div className="text-[11px] text-slate-400 mt-0.5">your 24/7 back-office</div>}
      </div>
    </div>
  );
}
