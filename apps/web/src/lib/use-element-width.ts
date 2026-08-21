import { useEffect, useRef, useState } from "react";

/**
 * Measures an element's content width so SVG charts can lay out in real
 * pixels rather than being scaled by `preserveAspectRatio` — scaling an SVG
 * distorts stroke widths and type, which is exactly what makes a chart look
 * cheap. Returns [ref, width]; width is 0 until first measurement.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setWidth(el.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
