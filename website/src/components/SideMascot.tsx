"use client";

import { useEffect, useState } from "react";

// Wide screens only: the mascot stands next to the receipt and reacts to the section you're reading.
export function SideMascot({ moods }: { moods: { key: string; src: string; say: string }[] }) {
  const [active, setActive] = useState<string | undefined>(moods[0]?.key);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1280px)").matches) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-mood]"));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive((visible[0].target as HTMLElement).dataset.mood);
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0, 0.25, 0.5] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const current = moods.find((m) => m.key === active) ?? moods[0];
  const unique = [...new Map(moods.map((m) => [m.src, m])).values()];

  return (
    <div className="pointer-events-none sticky top-28 hidden w-[200px] xl:block" aria-hidden>
      <div className="relative mb-3 ml-6 inline-block bg-paper px-3 py-2 text-[12px] font-bold text-ink shadow-[3px_3px_0_0_#000]">
        {current?.say}
        <span className="absolute -bottom-2 left-6 size-4 rotate-45 bg-paper" />
      </div>
      <div className="relative h-[300px] w-[200px]">
        {unique.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.src}
            src={m.src}
            alt=""
            width={200}
            height={300}
            loading="lazy"
            className="absolute inset-0 transition-[opacity,transform] duration-300"
            style={{ opacity: m.src === current?.src ? 1 : 0, transform: m.src === current?.src ? "none" : "translateY(8px)" }}
          />
        ))}
      </div>
    </div>
  );
}
