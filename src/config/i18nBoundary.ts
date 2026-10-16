import i18n from './i18n';

// ErrorBoundary is a class component OUTSIDE the React tree when it fires,
// so useTranslation() is unavailable. Read the current locale snapshot
// directly instead. If i18n is not initialized (the error may have happened
// during init), fall back to English so the user always sees real copy —
// never a raw key or an empty screen.
let cached: { title: string; message: string; retryLabel: string } | null = null;

export function getBoundaryText(): { title: string; message: string; retryLabel: string } {
  if (cached) return cached;
  try {
    cached = {
      title: i18n.t('common.somethingWentWrong', { defaultValue: 'Something went wrong' }),
      message: i18n.t('common.unexpectedError', { defaultValue: 'An unexpected error occurred' }),
      retryLabel: i18n.t('common.tryAgain', { defaultValue: 'Try Again' }),
    };
  } catch {
    cached = { title: 'Something went wrong', message: 'An unexpected error occurred', retryLabel: 'Try Again' };
  }
  return cached;
}

// Called on language change so the snapshot stays current.
export function resetBoundaryText() {
  cached = null;
}
