import { EN_TEMPLATES } from './en-templates';
import { JA_TEMPLATES } from './ja-templates';
import { type BuiltinTemplate, VI_TEMPLATES } from './vi-templates';

export { BUILTIN_TEMPLATES_VERSION } from './vi-templates';
export type { BuiltinTemplate };

/** The bundled templates in the given UI language (English for the others). */
export function templatesForLanguage(language: string): BuiltinTemplate[] {
  if (language.startsWith('vi')) return VI_TEMPLATES;
  if (language.startsWith('ja')) return JA_TEMPLATES;
  return EN_TEMPLATES;
}
