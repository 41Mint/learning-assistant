import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

export default function CodeFormReveal({ open, trigger, children }: {
  open: boolean;
  trigger: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ open, present: open, visit: 0 });
  const { present, visit } = state;
  // Keep the old form during collapse and start a fresh draft on every opening.
  if (open !== state.open) setState({ open, present: open || present, visit: visit + Number(open) });

  useLayoutEffect(() => {
    if (open || !present) return;
    trigger.current?.focus({ preventScroll: true });
    let active = true;
    const transitions = panel.current?.getAnimations() ?? [];
    void Promise.allSettled(transitions.map(({ finished }) => finished)).then(() => {
      if (active) setState((current) => ({ ...current, present: false }));
    });
    return () => { active = false; };
  }, [open, present, trigger]);

  if (!present) return null;
  return <div ref={panel} className="code-form-reveal" data-open={open || undefined} inert={!open}><div key={visit}>
    {children}
  </div></div>;
}
