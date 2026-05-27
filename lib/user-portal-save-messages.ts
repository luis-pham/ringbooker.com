/** Contextual copy for user-portal save toasts. */

const SETTINGS_SECTION_LABELS: Record<string, string> = {
  'business-knowledge-info': 'Business profile',
  'business-profile': 'Business profile',
  business: 'Business profile',
  hours: 'Business hours',
  services: 'Services',
  'services-hours': 'Services',
  staff: 'Staff',
  faqs: 'Policies & FAQ',
  faq: 'Policies & FAQ',
  'call-handling': 'Call handling',
  'call-transfer': 'Call transfer settings',
  'ai-voice': 'AI voice & greeting',
  'ai-call-behavior': 'AI behavior settings',
  'sms-notifications': 'SMS notifications',
  messaging: 'Messaging settings',
  integrations: 'Integrations',
};

const BOOKING_LINK_PROVIDER_LABELS: Record<string, string> = {
  glossgenius: 'GlossGenius',
  fresha: 'Fresha',
  booksy: 'Booksy',
  custom: 'Booking',
  vagaro: 'Vagaro',
  square: 'Square',
};

export function settingsSectionLabel(sectionId: string): string {
  return SETTINGS_SECTION_LABELS[sectionId] ?? 'Changes';
}

export function settingsSaveSuccessMessage(sectionId: string): string {
  return `${settingsSectionLabel(sectionId)} saved`;
}

export function bookingLinkSaveSuccessMessage(providerId: string): string {
  const label = BOOKING_LINK_PROVIDER_LABELS[providerId] ?? 'Booking link';
  return `${label} link saved`;
}

export function contextualSaveSuccessMessage(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Changes saved';
  if (/saved$/i.test(trimmed)) return trimmed;
  return `${trimmed} saved`;
}

export function formatSaveErrorMessage(error?: string | null, contextLabel?: string): string {
  const label = contextLabel?.trim().toLowerCase() || 'changes';

  if (!error || error === 'network_error') {
    return "Couldn't save. Check your connection and try again.";
  }
  if (error === 'settings_still_loading') {
    return 'Settings are still loading. Wait a moment and try again.';
  }
  if (error === 'plan_feature_locked') {
    return 'Upgrade your plan to save this setting.';
  }
  if (error === 'no_changes') {
    return 'No changes to save.';
  }
  if (error === 'save_failed' || error === 'booking_link_save_failed' || error === 'vagaro_booking_link_save_failed') {
    return `Couldn't save ${label}. Try again.`;
  }
  if (error.startsWith('Upgrade required')) {
    return error;
  }
  if (error === 'suggestion_apply_failed') {
    return "Couldn't apply website suggestions. Try again.";
  }
  if (error === 'suggestion_apply_network_error' || error === 'suggestion_dismiss_network_error') {
    return "Couldn't update suggestions. Check your connection and try again.";
  }
  if (error === 'invalid_current_password') {
    return 'Current password is incorrect.';
  }
  if (error === 'password_unchanged') {
    return 'Choose a different new password.';
  }

  const humanized = error.replace(/_/g, ' ');
  if (humanized.length > 80) {
    return `Couldn't save ${label}. Try again.`;
  }
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}
