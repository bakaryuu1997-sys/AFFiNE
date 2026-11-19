/**
 * Finds the most appropriate existing diagram document to open:
 * 1. Checks `lastOpenedId` in localStorage/session first (if still valid and not trashed).
 * 2. Scans for documents matching diagram markers (icons, standard titles, or isDiagram property).
 * 3. Sorts by most recently updated date so the active diagram is restored.
 */
export function findLatestDiagramDoc(
  docs: Array<{
    id: string;
    trash$: { value: boolean };
    title$: { value: string };
    updatedAt$?: { value?: number };
    createdAt$?: { value?: number };
    customProperty$?: (key: string) => { value?: string | null };
  }>,
  lastOpenedId?: string | null
): string | null {
  if (lastOpenedId) {
    const lastDoc = docs.find(d => d.id === lastOpenedId && !d.trash$.value);
    if (lastDoc) {
      return lastDoc.id;
    }
  }

  const activeDocs = docs.filter(d => !d.trash$.value);

  const diagramIndicators = [
    '🌐',
    '🤖',
    '⚡',
    '☁️',
    '🧱',
    '📊',
    '🔗',
    'Sơ đồ hệ thống',
    'System diagram',
    'システム構成図',
    'Kiến trúc',
  ];

  const matchedDocs = activeDocs.filter(d => {
    const isExplicit = d.customProperty$?.('isDiagram')?.value === 'true';
    if (isExplicit) return true;
    const title = d.title$.value || '';
    return diagramIndicators.some(indicator => title.includes(indicator));
  });

  if (matchedDocs.length === 0) {
    return null;
  }

  matchedDocs.sort((a, b) => {
    const timeA = a.updatedAt$?.value ?? a.createdAt$?.value ?? 0;
    const timeB = b.updatedAt$?.value ?? b.createdAt$?.value ?? 0;
    return timeB - timeA;
  });

  return matchedDocs[0].id;
}
