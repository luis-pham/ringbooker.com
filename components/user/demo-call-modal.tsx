'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useIsKnowledgeMobile } from '@/components/ui/BottomSheet';
import type { DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { DemoCallEmbed } from '@/components/user/demo-call-embed';

export type DemoCallModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vertical: DemoVerticalSlug;
  shopServices?: string[];
  businessName?: string;
};

export function DemoCallModal({ isOpen, onClose, vertical, shopServices, businessName }: DemoCallModalProps) {
  const isMobile = useIsKnowledgeMobile();

  useEffect(() => {
    if (!isOpen || isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (isMobile || !isOpen) return null;

  const content = (
    <>
      <style>{`
        .dcm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.48);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px}
        .dcm-dialog{background:#fff;border-radius:24px;width:min(480px,100%);max-height:calc(100dvh - 40px);overflow-y:auto;position:relative;box-shadow:0 24px 64px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06)}
        .dcm-head{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0;position:sticky;top:0;background:#fff;z-index:1;border-radius:24px 24px 0 0}
        .dcm-title{font-size:17px;font-weight:900;color:#111827;letter-spacing:-.02em}
        .dcm-close{border:none;background:none;cursor:pointer;font-size:18px;color:#9CA3AF;padding:6px;line-height:1;border-radius:8px;-webkit-appearance:none}
        .dcm-close:hover{color:#374151;background:#F3F4F6}
        .dcm-body{padding:16px 20px 24px}
      `}</style>
      <div className="dcm-overlay" role="presentation" onClick={onClose}>
        <div
          className="dcm-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Web voice demo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dcm-head">
            <span className="dcm-title">Web voice demo</span>
            <button type="button" className="dcm-close" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <div className="dcm-body">
            <DemoCallEmbed vertical={vertical} device="desktop" shopServices={shopServices} businessName={businessName} />
          </div>
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
