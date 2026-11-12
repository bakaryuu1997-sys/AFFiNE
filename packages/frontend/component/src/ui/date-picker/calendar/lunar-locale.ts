import { I18n } from '@affine/i18n';

import type { LunarLocale } from './lunar-names';

/** The language the lunar labels should use, following the app language. */
export function lunarLocale(): LunarLocale {
  const language = String(I18n.language ?? 'en');
  if (language.startsWith('vi')) return 'vi';
  if (language.startsWith('ja')) return 'ja';
  return 'en';
}
