'use client';

import { useEffect, useState } from 'react';

export type OnboardingAddGroupSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (groupName: string) => void;
  title: string;
  placeholder: string;
};

export function OnboardingAddGroupSheet({ isOpen, onClose, onConfirm, title, placeholder }: OnboardingAddGroupSheetProps) {
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (isOpen) setGroupName('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="onb-sheet-overlay" role="presentation" onClick={onClose}>
      <div className="onb-sheet" role="dialog" aria-modal="true" aria-labelledby="onb-sheet-add-group-title" onClick={(e) => e.stopPropagation()}>
        <div className="onb-sheet-handle" aria-hidden />
        <div className="onb-sheet-title" id="onb-sheet-add-group-title">
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
            Add group
          </button>
        </div>
      </div>
    </div>
  );
}
