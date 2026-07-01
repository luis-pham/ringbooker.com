import type { WebsiteImportErrorCode } from './types';

const WEBSITE_IMPORT_ERROR_MESSAGES: Record<WebsiteImportErrorCode, string> = {
  SHORT_LINK_RESOLUTION_FAILED: 'This Google Maps link looks invalid or expired. Try copying it again from the Share button.',
  PLACE_NOT_FOUND: "We couldn't find this business on Google Maps. You can fill in the details manually.",
  PLACE_ID_LOOKUP_FAILED: 'We had trouble looking up this Google Maps listing. You can fill in the details manually.',
};

/** Maps a classified failure to the user-facing message shown alongside the existing manual-fallback UX. */
export function websiteImportErrorMessage(errorCode?: WebsiteImportErrorCode | null): string | undefined {
  return errorCode ? WEBSITE_IMPORT_ERROR_MESSAGES[errorCode] : undefined;
}
