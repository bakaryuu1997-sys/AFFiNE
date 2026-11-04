/**
 * Lightweight UI translation layer for BlockSuite.
 *
 * BlockSuite has no dependency on `@affine/i18n`, so the host app (AFFiNE core)
 * registers a dictionary keyed by the original English text. Unknown strings are
 * returned untouched, so untranslated UI keeps working in English.
 *
 * The dictionary lives on `globalThis` so that every bundled copy of this module
 * (dynamic chunks, workers) shares the same instance.
 */
const STORE_KEY = '__BLOCKSUITE_UI_TRANSLATIONS__';

type Dictionary = Record<string, string>;

function getStore(): { dict: Dictionary } {
  const g = globalThis as unknown as Record<string, { dict: Dictionary }>;
  return (g[STORE_KEY] ??= { dict: {} });
}

/** Replace the active UI dictionary. Pass an empty object to go back to English. */
export function setUiTranslations(dict: Dictionary) {
  getStore().dict = dict;
}

/** Translate a UI string; falls back to the original English text. */
export function t(text: string): string {
  return getStore().dict[text] ?? text;
}
