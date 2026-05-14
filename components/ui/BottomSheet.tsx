'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

/** Matches knowledge portal “mobile” breakpoint (see `isKnowledgeWideLayout` 861px). */
export function useIsKnowledgeMobile() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => undefined;
      const mq = window.matchMedia('(max-width: 860px)');
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false),
    () => false,
  );
}

export type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** When true (default), sheet is not rendered at ≥861px — use for knowledge-only mobile flows. */
  mobileOnly?: boolean;
};

/**
 * Bottom sheet: reuses `.onb-sheet-*` styles from `user-settings.tsx` (same overlay/panel as onboarding group sheet).
 * Drag handle: swipe down to close. Overlay click and ✕ close.
 */
export function BottomSheet({ isOpen, onClose, title, children, mobileOnly = true }: BottomSheetProps) {
  const isMobile = useIsKnowledgeMobile();
  const reactId = useId();
  const titleId = `rb-bottom-sheet-title-${reactId.replace(/:/g, '')}`;
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || (mobileOnly && !isMobile)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, isMobile, mobileOnly]);

  if (mobileOnly && !isMobile) return null;
  if (!isOpen) return null;

  return (
    <div className="onb-sheet-overlay rb-bottom-sheet-overlay" role="presentation" onClick={onClose}>
      <div
        className="onb-sheet rb-bottom-sheet-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="onb-sheet-handle rb-bottom-sheet-handle"
          aria-hidden
          onTouchStart={(event) => {
            dragStartY.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            if (dragStartY.current == null) return;
            const endY = event.changedTouches[0]?.clientY ?? dragStartY.current;
            if (endY - dragStartY.current > 72) onClose();
            dragStartY.current = null;
          }}
        />
        <div className="rb-bottom-sheet-head">
          <div className="onb-sheet-title" id={titleId}>
            {title}
          </div>
          <button type="button" className="rb-bottom-sheet-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="rb-bottom-sheet-body">{children}</div>
      </div>
    </div>
  );
}
