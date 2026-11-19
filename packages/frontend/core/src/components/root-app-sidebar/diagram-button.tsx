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

import { findLatestDiagramDoc } from './diagram-finder';

const LAST_DIAGRAM_STORAGE_KEY = 'affine:last-system-diagram-id';

/**
 * Sidebar entry for the 2.5D system diagram:
 * - Clicking the row opens the most recently updated diagram document if present (preventing accidental duplicates even when renamed).
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
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LAST_DIAGRAM_STORAGE_KEY, record.id);
      }
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
      const lastOpenedId =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(LAST_DIAGRAM_STORAGE_KEY)
          : null;

      const targetDocId = findLatestDiagramDoc(
        docsService.list.docs$.value as any,
        lastOpenedId
      );

      if (targetDocId) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LAST_DIAGRAM_STORAGE_KEY, targetDocId);
        }
        workbench.openDoc(targetDocId);
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
