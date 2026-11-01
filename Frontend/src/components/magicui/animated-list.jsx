// Magic UI — Animated List : éléments qui apparaissent un à un (flux « en direct »).
import { Children, memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedListItem({ children }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, originY: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 40 }}
      layout
      className="mx-auto w-full"
    >
      {children}
    </motion.div>
  );
}

export const AnimatedList = memo(function AnimatedList({ children, className, delay = 1000, ...props }) {
  const [index, setIndex] = useState(0);
  const items = useMemo(() => Children.toArray(children), [children]);

  useEffect(() => {
    if (index >= items.length - 1) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % items.length), delay);
    return () => clearTimeout(t);
  }, [index, delay, items.length]);

  const visible = useMemo(() => items.slice(0, index + 1).reverse(), [index, items]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)} {...props}>
      <AnimatePresence>
        {visible.map((item) => (
          <AnimatedListItem key={item.key}>{item}</AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
});
