// Magic UI — Word Rotate : rotation verticale de mots (titre de la page d'accueil).
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function WordRotate({ words, duration = 2600, className, as = "span" }) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const Tag = motion[as];

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), duration);
    return () => clearInterval(id);
  }, [words, duration, reduce]);

  return (
    <span className="relative inline-flex overflow-hidden pb-[0.12em] align-bottom">
      <AnimatePresence mode="wait" initial={false}>
        <Tag
          key={words[index]}
          className={cn("inline-block", className)}
          initial={{ opacity: 0, y: "-0.6em", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "0.6em", filter: "blur(6px)" }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {words[index]}
        </Tag>
      </AnimatePresence>
    </span>
  );
}
