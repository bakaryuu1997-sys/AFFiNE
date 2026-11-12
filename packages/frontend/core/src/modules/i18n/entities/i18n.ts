import { notify } from '@affine/component';
import { DebugLogger } from '@affine/debug';
import {
  EDITOR_UI_TRANSLATIONS,
  getOrCreateI18n,
  i18nCompletenesses,
  type Language,
  SUPPORTED_LANGUAGES,
} from '@affine/i18n';
import { setUiTranslations } from '@blocksuite/affine/shared/utils';
import { effect, Entity, fromPromise, LiveData } from '@toeverything/infra';
import { catchError, EMPTY, exhaustMap } from 'rxjs';

import type { GlobalCache } from '../../storage';

export type LanguageInfo = {
  key: Language;
  name: string;
  originalName: string;
  completeness: number;
};

const logger = new DebugLogger('i18n');

const OFFERED_LANGUAGES: Language[] = ['vi', 'en', 'ja'];

function mapLanguageInfo(language: Language = 'en'): LanguageInfo {
  const languageInfo = SUPPORTED_LANGUAGES[language];

  return {
    key: language,
    name: languageInfo.name,
    originalName: languageInfo.originalName,
    completeness: i18nCompletenesses[language],
  };
}

export class I18n extends Entity {
  private readonly i18n = getOrCreateI18n();

  get i18next() {
    return this.i18n;
  }

  readonly currentLanguageKey$ = LiveData.from(
    this.cache.watch<Language>('i18n_lng'),
    undefined
  );

  readonly currentLanguage$ = this.currentLanguageKey$
    .distinctUntilChanged()
    .map(mapLanguageInfo);

  /**
   * This fork keeps Vietnamese, English and Japanese complete, so only those
   * are offered. The other language files stay in the repo, untouched.
   */
  readonly languageList: Array<LanguageInfo> = OFFERED_LANGUAGES.map(language =>
    mapLanguageInfo(language)
  );

  constructor(private readonly cache: GlobalCache) {
    super();
    this.i18n.on('languageChanged', (language: Language) => {
      this.applyDocumentLanguage(language);
      this.loadEditorTranslations(language);
      this.cache.set('i18n_lng', language);
    });
  }

  init() {
    const language = this.currentLanguageKey$.value ?? 'vi';
    this.applyDocumentLanguage(language);
    this.changeLanguage(language);
  }

  /** BlockSuite has no i18n of its own; feed it a dictionary for the active language. */
  private loadEditorTranslations(language: Language) {
    const loader = EDITOR_UI_TRANSLATIONS[language];
    if (!loader) {
      setUiTranslations({});
      return;
    }
    loader()
      .then(module => setUiTranslations(module.default))
      .catch(error =>
        logger.error('Failed to load editor translations', error)
      );
  }

  private applyDocumentLanguage(language: Language) {
    document.documentElement.lang = language;
    document.documentElement.dir = SUPPORTED_LANGUAGES[language]?.rtl
      ? 'rtl'
      : 'ltr';
  }

  changeLanguage = effect(
    exhaustMap((language: string) =>
      fromPromise(() => this.i18n.changeLanguage(language)).pipe(
        catchError(error => {
          notify({
            theme: 'error',
            title: 'Failed to change language',
            message: 'Error occurs when loading language files',
          });

          logger.error('Failed to change language', error);

          return EMPTY;
        })
      )
    )
  );
}
