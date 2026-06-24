"use client";

import { ContainerScroll } from "@/components/ui/container-scroll-animation";

export default function LandingScroll() {
  return (
    <ContainerScroll
      titleComponent={
        <>
          <h2 className="text-3xl md:text-4xl font-semibold text-ink">
            One order in, three invoices out
            <br />
            <span className="text-3xl md:text-[5rem] font-bold mt-1 leading-none bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 bg-clip-text text-transparent">
              The cascade, automated
            </span>
          </h2>
        </>
      }
    >
      {/* Dashboard preview. Swap for a real screenshot anytime. */}
      <img
        src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80"
        alt="Lily dashboard preview"
        height={720}
        width={1400}
        className="mx-auto h-full w-full rounded-2xl object-cover object-left-top"
        draggable={false}
      />
    </ContainerScroll>
  );
}
