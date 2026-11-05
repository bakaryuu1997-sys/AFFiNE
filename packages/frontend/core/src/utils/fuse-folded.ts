import { foldDiacritics } from '@blocksuite/affine/shared/utils';
import Fuse, { type FuseResult, type IFuseOptions } from 'fuse.js';

/**
 * Fuse.js with diacritic-insensitive matching (so "viet" finds "Việt").
 *
 * Both the searched values and the query are folded. Folding keeps the string
 * length for precomposed text, so `matches[].indices` still point into the
 * original title and highlighting keeps working.
 */
function foldedGetFn(obj: unknown, path: string | string[]) {
  const value = Fuse.config.getFn(obj as never, path);
  if (Array.isArray(value)) return value.map(foldDiacritics);
  return typeof value === 'string' ? foldDiacritics(value) : value;
}

export function createFoldedFuse<T>(
  list: readonly T[],
  options: IFuseOptions<T>
) {
  const fuse = new Fuse(list, { ...options, getFn: foldedGetFn });
  return {
    search: (query: string): FuseResult<T>[] =>
      fuse.search(foldDiacritics(query)),
  };
}
