// Magic UI — Shimmer Button : reflet qui fait le tour du bouton (CTA principaux).
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const ShimmerButton = forwardRef(function ShimmerButton(
  {
    shimmerColor = "#bfe8ff",
    shimmerSize = "0.06em",
    shimmerDuration = "3s",
    borderRadius = "0.75rem",
    background = "linear-gradient(135deg, #034eaa 0%, #0082fd 60%, #02a9fc 100%)",
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      style={{
        "--spread": "90deg",
        "--shimmer-color": shimmerColor,
        "--radius": borderRadius,
        "--speed": shimmerDuration,
        "--cut": shimmerSize,
        "--bg": background,
      }}
      className={cn(
        "group relative z-0 flex cursor-pointer items-center justify-center gap-2 overflow-hidden [border-radius:var(--radius)] border border-white/15 px-6 py-3 font-semibold whitespace-nowrap text-white [background:var(--bg)]",
        "shadow-[0_12px_30px_-12px_rgb(0_130_253/0.8)] transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4",
        className
      )}
      {...props}
    >
      <div className="@container-[size] absolute inset-0 -z-30 overflow-visible blur-[2px]">
        <div className="absolute inset-0 aspect-[1] h-[100cqh] animate-shimmer-slide rounded-none [mask:none]">
          <div className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      {children}
      <div className="absolute inset-0 size-full rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1f] transform-gpu transition-all duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />
      <div className="absolute inset-(--cut) -z-20 [border-radius:var(--radius)] [background:var(--bg)]" />
    </button>
  );
});
