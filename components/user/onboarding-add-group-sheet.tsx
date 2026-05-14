'use client';

import { useEffect, useState } from 'react';

export type OnboardingAddGroupSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (groupName: string) => void;
  title: string;
  placeholder: string;
  /** Pre-fill when opening (e.g. rename group). */
  initialName?: string;
  /** Primary action label (default: Add group). */
  confirmLabel?: string;
  /** Override `aria-labelledby` target (avoid duplicate ids when multiple sheets exist). */
  titleId?: string;
};

export function OnboardingAddGroupSheet({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder,
  initialName,
  confirmLabel = 'Add group',
  titleId = 'onb-sheet-add-group-title',
}: OnboardingAddGroupSheetProps) {
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (isOpen) setGroupName(initialName ?? '');
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  return (
    <div className="onb-sheet-overlay" role="presentation" onClick={onClose}>
      <div className="onb-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="onb-sheet-handle" aria-hidden />
        <div className="onb-sheet-title" id={titleId}>
          {title}
        </div>
        <div className="onb-sheet-field">
          <div className="onb-sheet-label">Group name</div>
          <input
            className="onb-sheet-input"
            placeholder={placeholder}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => {
              const t = e.currentTarget.value.trim();
              if (e.key === 'Enter' && t) onConfirm(t);
              if (e.key === 'Escape') onClose();
            }}
            autoFocus
            aria-label="Group name"
          />
        </div>
        <div className="onb-sheet-actions">
          <button type="button" className="onb-sheet-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="onb-sheet-save" disabled={!groupName.trim()} onClick={() => onConfirm(groupName.trim())}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
