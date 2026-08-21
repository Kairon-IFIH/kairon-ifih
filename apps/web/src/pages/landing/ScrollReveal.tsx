import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
  children: ReactNode;
  /** CSS selector, relative to the wrapper, of items to stagger. Defaults to direct children via >* */
  stagger?: string;
  className?: string;
}

export function ScrollReveal({ children, stagger = ":scope > *", className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const targets = el.querySelectorAll(stagger);
    const animateTargets = targets.length > 0 ? targets : [el];

    gsap.set(animateTargets, { willChange: "transform, opacity" });
    const tween = gsap.fromTo(
      animateTargets,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "willChange",
        scrollTrigger: {
          trigger: el,
          start: "top 82%",
          once: true,
        },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
