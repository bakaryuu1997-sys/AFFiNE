import { notify } from '@affine/component';
import { SystemDiagramFlavour } from '@affine/core/blocksuite/system-diagram/model';
import { createSampleSpec } from '@affine/core/blocksuite/system-diagram/spec';
import { S, sampleNames } from '@affine/core/blocksuite/system-diagram/strings';
import { MenuItem } from '@affine/core/modules/app-sidebar/views';
import { DocsService } from '@affine/core/modules/doc';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { ConnectorCIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback } from 'react';

/**
 * Sidebar entry for the 2.5D system diagram: creates a new doc that already
 * holds a sample diagram (web tier, cache, database) and opens it. The block
 * can still be inserted into any doc with `/`.
 */
export const AppSidebarDiagramButton = () => {
  const docsService = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;

  const onCreate = useCallback(() => {
    try {
      const title = S.untitled;
      const spec = createSampleSpec(sampleNames());
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
      onClick={onCreate}
    >
      {S.slashName}
    </MenuItem>
  );
};
