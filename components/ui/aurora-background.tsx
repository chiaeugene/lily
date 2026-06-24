"use client";

import React from "react";

/**
 * Aurora background — soft animated colour ribbons over a light base (CSS only,
 * no WebGL). Used on the login and landing pages. The heavy gradient lives in
 * the `.aurora` class in globals.css; this component just frames it.
 */
export function AuroraBackground({
  className = "",
  children,
  showRadialGradient = true,
}: {
  className?: string;
  children?: React.ReactNode;
  showRadialGradient?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col min-h-dvh items-center justify-center bg-white text-ink overflow-hidden ${className}`}
    >
      <div className="absolute inset-0" aria-hidden="true">
        <div className={`aurora ${showRadialGradient ? "aurora--masked" : ""}`} />
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

export default AuroraBackground;
