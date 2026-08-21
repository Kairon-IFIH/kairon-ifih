import { useEffect, useState } from "react";

interface TypewriterOptions {
  typingSpeedMs?: number;
  deletingSpeedMs?: number;
  pauseMs?: number;
}

/** Cycles through `words`, typing and deleting each in turn. Returns the current
 * substring and the active word index (so callers can drive a dot indicator). */
export function useTypewriter(words: string[], options: TypewriterOptions = {}) {
  const { typingSpeedMs = 55, deletingSpeedMs = 28, pauseMs = 1800 } = options;
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(words[0] ?? "");
      return;
    }

    const current = words[wordIndex] ?? "";
    let timeout: number;

    if (phase === "typing") {
      if (text.length < current.length) {
        timeout = window.setTimeout(() => setText(current.slice(0, text.length + 1)), typingSpeedMs);
      } else {
        timeout = window.setTimeout(() => setPhase("pausing"), pauseMs);
      }
    } else if (phase === "pausing") {
      timeout = window.setTimeout(() => setPhase("deleting"), 0);
    } else {
      if (text.length > 0) {
        timeout = window.setTimeout(() => setText(current.slice(0, text.length - 1)), deletingSpeedMs);
      } else {
        timeout = window.setTimeout(() => {
          setWordIndex((i) => (i + 1) % words.length);
          setPhase("typing");
        }, 0);
      }
    }

    return () => window.clearTimeout(timeout);
  }, [text, phase, wordIndex, words, typingSpeedMs, deletingSpeedMs, pauseMs]);

  return { text, wordIndex, setWordIndex, setPhase };
}
