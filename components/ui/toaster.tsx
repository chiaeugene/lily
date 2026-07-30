"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast host, styled with Lily's own tokens rather than Sonner's
 * defaults so notifications match the rest of the UI.
 *
 * Replaces native alert(), which blocked the whole page, couldn't be styled,
 * and looked like a browser error even when reporting success.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-surface !text-ink !border !border-line !shadow-pop !rounded-xl !text-[13px] !font-sans",
          description: "!text-muted",
          actionButton: "!bg-primary !text-white",
          cancelButton: "!bg-surface-2 !text-muted",
          success: "!border-profit/30",
          error: "!border-loss/30",
        },
      }}
    />
  );
}

export default Toaster;
