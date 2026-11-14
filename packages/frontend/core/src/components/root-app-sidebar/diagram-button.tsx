import { notify } from '@affine/component';
import { SystemDiagramFlavour } from '@affine/core/blocksuite/system-diagram/model';
import { createFullSampleSpec } from '@affine/core/blocksuite/system-diagram/spec';
import { S, sampleNames } from '@affine/core/blocksuite/system-diagram/strings';
import { MenuItem } from '@affine/core/modules/app-sidebar/views';
import { DocsService } from '@affine/core/modules/doc';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { ConnectorCIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback } from 'react';

/**
 * Sidebar entry for the 2.5D system diagram: opens existing diagram document if present,
 * or creates a new one once so it doesn't clutter the workspace with duplicates.
 */
export const AppSidebarDiagramButton = () => {
  const docsService = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;

  const onOpenOrCreate = useCallback(() => {
    try {
      // Find existing non-trashed diagram doc first to prevent creating multiple duplicates
      const existing = docsService.list.docs$.value.find(
        doc =>
          !doc.trash$.value &&
          (doc.title$.value === S.untitled ||
            doc.title$.value === 'Sơ đồ hệ thống' ||
            doc.title$.value === 'System diagram' ||
            doc.title$.value === 'システム構成図')
      );
      if (existing) {
        workbench.openDoc(existing.id);
        return;
      }

      const title = S.untitled;
      const spec = createFullSampleSpec(sampleNames());
      const record = docsService.createDoc({
        title,
        primaryMode: 'page',
        docProps: {
          onStoreLoad: (store, { noteId }) => {
            // before the empty paragraph, so the cursor can still go below it
            store.addBlock(
              SystemDiagramFlavour as never,
              { title, spec },
              noteId,
              0
            );
          },
        },
      });
      workbench.openDoc(record.id);
    } catch (error) {
      console.error(error);
      notify.error({
        title: error instanceof Error ? error.message : String(error),
      });
    }
  }, [docsService, workbench]);

  return (
    <MenuItem
      data-testid="slider-bar-system-diagram-button"
      icon={<ConnectorCIcon />}
      onClick={onOpenOrCreate}
    >
      {S.slashName}
    </MenuItem>
  );
};
