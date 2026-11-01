import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold transition-[background-color,color,box-shadow,transform,border-color] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgb(0_130_253/0.7)] hover:bg-electric",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline: "border border-border bg-transparent text-foreground hover:border-input hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
        light: "bg-white text-navy hover:bg-star shadow-[0_10px_30px_-12px_rgb(0_0_0/0.5)]",
        glass: "border border-white/15 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-[0.6rem] px-3 text-xs",
        lg: "h-12 px-6 text-[0.95rem]",
        icon: "size-10",
        "icon-sm": "size-8 rounded-[0.6rem]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export const Button = forwardRef(function Button(
  { className, variant, size, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
