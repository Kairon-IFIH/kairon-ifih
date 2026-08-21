import type { ReactNode } from "react";
import { X } from "lucide-react";
import "./slide-panel.css";

interface SlidePanelProps {
  title: string;
  open: boolean;
  onClose(): void;
  children: ReactNode;
}

export function SlidePanel({ title, open, onClose, children }: SlidePanelProps) {
  if (!open) return null;
  return (
    <div className="slide-panel__overlay" onClick={onClose}>
      <div className="slide-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="slide-panel__header">
          <h2 className="slide-panel__title">{title}</h2>
          <button type="button" className="slide-panel__close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="slide-panel__body">{children}</div>
      </div>
    </div>
  );
}
