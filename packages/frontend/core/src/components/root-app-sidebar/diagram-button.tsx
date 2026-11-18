import { IconButton, notify } from '@affine/component';
import { SystemDiagramFlavour } from '@affine/core/blocksuite/system-diagram/model';
import { createFullSampleSpec } from '@affine/core/blocksuite/system-diagram/spec';
import { S, sampleNames } from '@affine/core/blocksuite/system-diagram/strings';
import { MenuItem } from '@affine/core/modules/app-sidebar/views';
import { DocsService } from '@affine/core/modules/doc';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { ConnectorCIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import type { MouseEvent } from 'react';
import { useCallback } from 'react';

/**
 * Sidebar entry for the 2.5D system diagram:
 * - Clicking the row opens an existing diagram document if present (preventing accidental duplicates).
 * - Clicking the "+" action button creates a brand-new diagram document explicitly.
 */
export const AppSidebarDiagramButton = () => {
  const docsService = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;

  const createNewDiagram = useCallback(() => {
    try {
      const title = S.untitled;
      const spec = createFullSampleSpec(sampleNames());
      const record = docsService.createDoc({
        title,
        primaryMode: 'page',
        docProps: {
          onStoreLoad: (store, { noteId }) => {
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

  const onOpenOrCreate = useCallback(() => {
    try {
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
      createNewDiagram();
    } catch (error) {
      console.error(error);
      notify.error({
        title: error instanceof Error ? error.message : String(error),
      });
    }
  }, [createNewDiagram, docsService, workbench]);

  const onClickCreateNew = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      createNewDiagram();
    },
    [createNewDiagram]
  );

  return (
    <MenuItem
      data-testid="slider-bar-system-diagram-button"
      icon={<ConnectorCIcon />}
      onClick={onOpenOrCreate}
      postfixDisplay="always"
      postfix={
        <IconButton
          size="16"
          data-testid="slider-bar-new-system-diagram-button"
          title="Tạo sơ đồ hệ thống mới"
          aria-label="Tạo sơ đồ hệ thống mới"
          onClick={onClickCreateNew}
        >
          <PlusIcon />
        </IconButton>
      }
    >
      {S.slashName}
    </MenuItem>
  );
};
