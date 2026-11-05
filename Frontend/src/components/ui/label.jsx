import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      className={cn("mb-1.5 block text-[0.8rem] font-medium text-muted-foreground select-none", className)}
      {...props}
    />
  );
}
