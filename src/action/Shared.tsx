import { useAppStore } from "../state/store";
import { useEffect, useRef, type ReactNode } from "react";
import type { TokenView } from "../domain/types";
export function Dialog({ title, onClose, children }: { title: string; onClose(): void; wide?: boolean; children: ReactNode }) {
  const error = useAppStore((store) => store.error);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current; element?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key === "Tab" && element) {
        const nodes = [...element.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')];
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    element?.addEventListener("keydown", handler);
    return () => { element?.removeEventListener("keydown", handler); previous?.focus(); };
  }, [onClose]);
  return <div className="dialog-backdrop"><section ref={ref} tabIndex={-1} className="dialog wide" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label="Fechar" onClick={onClose}>×</button></header>{error && <p className="flash error" role="alert">{error}</p>}{children}</section></div>;
}
export function TokenPortrait({ token }: { token?: TokenView }) {
  return token?.imageUrl ? <img className="portrait" src={token.imageUrl} alt="" /> : <span className="portrait fallback">{token?.name.slice(0, 1).toUpperCase() ?? "?"}</span>;
}
