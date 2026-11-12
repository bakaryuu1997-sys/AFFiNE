import { DUE_TOKEN } from './parse-todo';

export interface TextPatch {
  index: number;
  length: number;
  insert: string;
}

/**
 * How to change the text of a checkbox so its due date becomes `due` (a
 * `YYYY-MM-DD` date, or null to clear it). An existing token is rewritten in
 * place and keeps its time of day; otherwise the token is appended.
 */
export function planDueEdit(text: string, due: string | null): TextPatch {
  const token = DUE_TOKEN.exec(text);
  if (token) {
    if (due === null) {
      // drop the token together with the space in front of it
      return { index: token.index, length: token[0].length, insert: '' };
    }
    const time = token[3] !== undefined ? ` ${token[3]}:${token[4]}` : '';
    return {
      index: token.index + token[1].length,
      length: token[0].length - token[1].length,
      insert: `@${due}${time}`,
    };
  }
  if (due === null) return { index: text.length, length: 0, insert: '' };
  const space = text === '' || text.endsWith(' ') ? '' : ' ';
  return { index: text.length, length: 0, insert: `${space}@${due}` };
}

export function applyPatch(text: string, patch: TextPatch): string {
  return (
    text.slice(0, patch.index) +
    patch.insert +
    text.slice(patch.index + patch.length)
  );
}
