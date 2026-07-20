import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  showWordmark = true,
  tone = "light",
  size = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  tone?: "light" | "dark";
  size?: "compact" | "default" | "large" | "hero";
}) {
  const isCompact = size === "compact";
  const dimensions = size === "hero" ? 88 : size === "large" ? 64 : isCompact ? 40 : 48;
  const wordmarkSize = size === "hero" ? "text-2xl" : size === "large" ? "text-xl" : isCompact ? "text-base" : "text-lg";

  return (
    <span className={cn("inline-flex items-center", isCompact ? "gap-3" : "gap-3.5", className)}>
      <span className="relative grid shrink-0 place-items-center before:absolute before:inset-1 before:-z-10 before:rounded-2xl before:bg-primary/20 before:blur-lg">
        <Image
          src="/traceframe-mark.svg"
          alt=""
          width={dimensions}
          height={dimensions}
          priority
        />
      </span>
      {showWordmark ? (
        <span
          className={cn(
            "font-semibold tracking-[0.035em]",
            wordmarkSize,
            tone === "light" ? "text-foreground" : "text-[#11141B]",
          )}
        >
          Trace<span className={tone === "light" ? "text-[#AAB3C3]" : "text-[#535B6B]"}>frame</span><span className="text-accent">.</span>
        </span>
      ) : null}
    </span>
  );
}
