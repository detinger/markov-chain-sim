import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal dialog (portaled to <body>): names itself, traps focus, closes on Escape, restores trigger focus, makes the app inert. */
export function Dialog({ title, onClose, children, footer, size }: {
  title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? ref.current)?.focus();
    return () => {
      root?.removeAttribute('inert');
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const [firstEl, lastEl] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
  };

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog ${size === 'sm' ? 'dialog-sm' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface TabDef<K extends string> { id: K; label: string; icon?: ReactNode; badge?: ReactNode }

/** Tabs with roving tabindex and Arrow/Home/End navigation (automatic activation — panels are cheap). */
export function Tabs<K extends string>({ tabs, active, onChange, label, idPrefix }: {
  tabs: TabDef<K>[]; active: K; onChange: (k: K) => void; label: string; idPrefix: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          role="tab"
          id={`${idPrefix}-tab-${t.id}`}
          aria-controls={`${idPrefix}-panel-${t.id}`}
          aria-selected={active === t.id}
          tabIndex={active === t.id ? 0 : -1}
          className="tab"
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {t.icon}{t.label}{t.badge}
        </button>
      ))}
    </div>
  );
}

/** Connected-state product mark: three states, directed links, one return arc (STYLE.md §13.1). */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="4" cy="14" r="2.4" />
        <circle cx="10" cy="5" r="2.4" />
        <circle cx="16" cy="14" r="2.4" />
        <path d="M5.4 11.8 8.6 7.2M11.4 7.2l3.2 4.6" />
        <path d="M13.6 15.6c-2 1.4-5.2 1.4-7.2 0" />
      </svg>
    </span>
  );
}

export interface Toast { id: number; kind: 'info' | 'success' | 'error'; text: string }

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

const CHART_VARS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-7'] as const;
/** Stable categorical color by persistent position in the states list (creation order), never by label or rank. */
export function stateColorVar(index: number): string {
  return `var(--${CHART_VARS[index % CHART_VARS.length]})`;
}
export const CHART_TOKENS = CHART_VARS;
