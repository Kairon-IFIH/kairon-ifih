import { useEffect, useRef, useState } from "react";

export interface HeadlineSegment {
  text: string;
  accent?: boolean;
}

interface TypewriterHeadlineProps {
  segments: HeadlineSegment[];
  speedMs?: number;
  startDelayMs?: number;
  onDone?(): void;
  className?: string;
}

/** Types `segments` out character by character, in order, then leaves a
 * blinking caret at the end — the CSS-Tricks typewriter effect, but driven
 * in JS so it can span multiple lines and colored inline segments. */
export function TypewriterHeadline({ segments, speedMs = 42, startDelayMs = 300, onDone, className }: TypewriterHeadlineProps) {
  const fullLength = segments.reduce((sum, s) => sum + s.text.length, 0);
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(fullLength);
      setDone(true);
      onDoneRef.current?.();
      return;
    }

    let cancelled = false;
    let count = 0;
    let intervalId: number;

    const startTimeout = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        if (cancelled) return;
        count += 1;
        setRevealed(count);
        if (count >= fullLength) {
          window.clearInterval(intervalId);
          setDone(true);
          onDoneRef.current?.();
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimeout);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullLength, speedMs, startDelayMs]);

  let consumed = 0;
  return (
    <h1 className={className}>
      <span aria-hidden="true">
        {segments.map((segment, i) => {
          const start = consumed;
          consumed += segment.text.length;
          const visible = Math.max(0, Math.min(segment.text.length, revealed - start));
          const shown = segment.text.slice(0, visible);
          return segment.accent ? <em key={i}>{shown}</em> : <span key={i}>{shown}</span>;
        })}
        <span className={"typewriter-caret" + (done ? " typewriter-caret--settled" : "")} />
      </span>
      <span className="sr-only">{segments.map((s) => s.text).join("")}</span>
    </h1>
  );
}
