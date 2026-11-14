import { notify, toast, useConfirmModal } from '@affine/component';
import { Menu, MenuItem, MenuSeparator } from '@affine/component/ui/menu';
import { useGuard } from '@affine/core/components/guard';
import { useBlockSuiteMetaHelper } from '@affine/core/components/hooks/affine/use-block-suite-meta-helper';
import { useExportPage } from '@affine/core/components/hooks/affine/use-export-page';
import { useSharingUrl } from '@affine/core/components/hooks/affine/use-share-url';
import { Export, MoveToTrash } from '@affine/core/components/page-list';
import { IsFavoriteIcon } from '@affine/core/components/pure/icons';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { EditorService } from '@affine/core/modules/editor';
import { GuardService } from '@affine/core/modules/permissions';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { ViewService } from '@affine/core/modules/workbench/services/view';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import type { Store } from '@blocksuite/affine/store';
import {
  DuplicateIcon,
  EdgelessIcon,
  EditIcon,
  FrameIcon,
  ImportIcon,
  InformationIcon,
  LinkIcon,
  OpenInNewIcon,
  PageIcon,
  SplitViewIcon,
  TocIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { HeaderDropDownButton } from '../../../components/pure/header-drop-down-button';
import { useFavorite } from '../favorite';

type PageMenuProps = {
  rename?: () => void;
  page: Store;
  isJournal?: boolean;
  containerWidth: number;
};

export const PageHeaderMenuButton = ({
  rename,
  page,
  isJournal,
  containerWidth,
}: PageMenuProps) => {
  const editorService = useService(EditorService);
  const isInTrash = useLiveData(
    editorService.editor.doc.meta$.map(meta => meta.trash)
  );

  const handleMenuOpenChange = useCallback((open: boolean) => {
    if (open) {
      track.$.header.docOptions.open();
    }
  }, []);

  if (isInTrash) {
    return null;
  }

  return (
    <Menu
      items={
        <PageHeaderMenuItem
          page={page}
          containerWidth={containerWidth}
          rename={rename}
          isJournal={isJournal}
        />
      }
      contentOptions={{
        align: 'center',
      }}
      rootOptions={{
        onOpenChange: handleMenuOpenChange,
      }}
    >
      <HeaderDropDownButton />
    </Menu>
  );
};

// fixme: refactor this file
const PageHeaderMenuItem = ({ rename, page, isJournal }: PageMenuProps) => {
  const pageId = page?.id;
  const t = useI18n();

  const workspace = useService(WorkspaceService).workspace;
  const guardService = useService(GuardService);
  const editorService = useService(EditorService);
  const currentMode = useLiveData(editorService.editor.mode$);
  const primaryMode = useLiveData(editorService.editor.doc.primaryMode$);

  const workbench = useService(WorkbenchService).workbench;

  const { favorite, toggleFavorite } = useFavorite(pageId);

  const { duplicate } = useBlockSuiteMetaHelper();

  const view = useService(ViewService).view;

  const openSidePanel = useCallback(
    (id: string) => {
      workbench.openSidebar();
      view.activeSidebarTab(id);
    },
    [workbench, view]
  );

  const openAllFrames = useCallback(() => {
    openSidePanel('frame');
  }, [openSidePanel]);

  const openOutlinePanel = useCallback(() => {
    openSidePanel('outline');
  }, [openSidePanel]);

  const workspaceDialogService = useService(WorkspaceDialogService);
  const openInfoModal = useCallback(() => {
    track.$.header.pageInfo.open();
    workspaceDialogService.open('doc-info', { docId: pageId });
  }, [workspaceDialogService, pageId]);

  const handleOpenInNewTab = useCallback(() => {
    workbench.openDoc(pageId, {
      at: 'new-tab',
    });
  }, [pageId, workbench]);

  const handleOpenInSplitView = useCallback(() => {
    workbench.openDoc(pageId, {
      at: 'tail',
    });
  }, [pageId, workbench]);

  const { openConfirmModal } = useConfirmModal();

  const handleOpenTrashModal = useCallback(() => {
    track.$.header.docOptions.deleteDoc();
    openConfirmModal({
      title: t['com.affine.moveToTrash.confirmModal.title'](),
      description: t['com.affine.moveToTrash.confirmModal.description']({
        title: editorService.editor.doc.title$.value || t['Untitled'](),
      }),
      cancelText: t['com.affine.confirmModal.button.cancel'](),
      confirmText: t.Delete(),
      confirmButtonOptions: {
        variant: 'error',
      },
      onConfirm: async () => {
        const canTrash = await guardService.can('Doc_Trash', pageId);
        if (!canTrash) {
          toast(t['com.affine.no-permission']());
          return;
        }
        await editorService.editor.doc.moveToTrash();
      },
    });
  }, [editorService.editor.doc, guardService, openConfirmModal, pageId, t]);

  const handleRename = useCallback(() => {
    rename?.();
    track.$.header.docOptions.renameDoc();
  }, [rename]);

  const handleSwitchMode = useCallback(() => {
    const mode = primaryMode === 'page' ? 'edgeless' : 'page';
    editorService.editor.setMode(mode);
    editorService.editor.doc.setPrimaryMode(mode);
    track.$.header.docOptions.switchPageMode({
      mode,
    });
    notify.success({
      title:
        primaryMode === 'page'
          ? t['com.affine.toastMessage.defaultMode.edgeless.title']()
          : t['com.affine.toastMessage.defaultMode.page.title'](),
      message:
        primaryMode === 'page'
          ? t['com.affine.toastMessage.defaultMode.edgeless.message']()
          : t['com.affine.toastMessage.defaultMode.page.message'](),
    });
  }, [primaryMode, editorService, t]);

  const exportHandler = useExportPage();

  const handleDuplicate = useCallback(() => {
    duplicate(pageId);
    track.$.header.docOptions.createDoc({
      control: 'duplicate',
    });
  }, [duplicate, pageId]);

  const handleOpenDocs = useCallback(
    (result: {
      docIds: string[];
      entryId?: string;
      isWorkspaceFile?: boolean;
    }) => {
      const { docIds, entryId, isWorkspaceFile } = result;
      // If the imported file is a workspace file, open the entry page.
      if (isWorkspaceFile && entryId) {
        workbench.openDoc(entryId);
      } else if (!docIds.length) {
        return;
      }
      // Open all the docs when there are multiple docs imported.
      if (docIds.length > 1) {
        workbench.openAll();
      } else {
        // Otherwise, open the only doc.
        workbench.openDoc(docIds[0]);
      }
    },
    [workbench]
  );

  const handleOpenImportModal = useCallback(() => {
    track.$.header.importModal.open();
    workspaceDialogService.open('import', undefined, payload => {
      if (!payload) {
        return;
      }
      handleOpenDocs(payload);
    });
  }, [workspaceDialogService, handleOpenDocs]);

  const handleToggleFavorite = useCallback(() => {
    track.$.header.docOptions.toggleFavorite();
    toggleFavorite();
  }, [toggleFavorite]);

  const { onClickCopyLink } = useSharingUrl({
    workspaceId: workspace.id,
    pageId,
  });

  const handleCopyLink = useCallback(() => {
    onClickCopyLink(currentMode);
  }, [currentMode, onClickCopyLink]);

  const canEdit = useGuard('Doc_Update', pageId);
  const canMoveToTrash = useGuard('Doc_Trash', pageId);

  return (
    <>
      {!isJournal && (
        <MenuItem
          prefixIcon={<EditIcon />}
          data-testid="editor-option-menu-rename"
          onSelect={handleRename}
          disabled={!canEdit}
        >
          {t['Rename']()}
        </MenuItem>
      )}
      <MenuItem
        prefixIcon={primaryMode === 'page' ? <EdgelessIcon /> : <PageIcon />}
        data-testid="editor-option-menu-edgeless"
        onSelect={handleSwitchMode}
        disabled={!canEdit}
      >
        {primaryMode === 'page'
          ? t['com.affine.editorDefaultMode.edgeless']()
          : t['com.affine.editorDefaultMode.page']()}
      </MenuItem>
      <MenuItem
        data-testid="editor-option-menu-favorite"
        onSelect={handleToggleFavorite}
        prefixIcon={<IsFavoriteIcon favorite={favorite} />}
      >
        {favorite
          ? t['com.affine.favoritePageOperation.remove']()
          : t['com.affine.favoritePageOperation.add']()}
      </MenuItem>
      <MenuItem
        prefixIcon={<LinkIcon />}
        data-testid="editor-option-menu-copy-link"
        onSelect={handleCopyLink}
      >
        {t['com.affine.share-menu.copy']()}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        prefixIcon={<OpenInNewIcon />}
        data-testid="editor-option-menu-open-in-new-tab"
        onSelect={handleOpenInNewTab}
      >
        {t['com.affine.workbench.tab.page-menu-open']()}
      </MenuItem>
      {BUILD_CONFIG.isElectron && (
        <MenuItem
          prefixIcon={<SplitViewIcon />}
          data-testid="editor-option-menu-open-in-split-new"
          onSelect={handleOpenInSplitView}
        >
          {t['com.affine.workbench.split-view.page-menu-open']()}
        </MenuItem>
      )}

      <MenuSeparator />
      <MenuItem
        prefixIcon={<InformationIcon />}
        data-testid="editor-option-menu-info"
        onSelect={openInfoModal}
      >
        {t['com.affine.page-properties.page-info.view']()}
      </MenuItem>
      {currentMode === 'page' ? (
        <MenuItem
          prefixIcon={<TocIcon />}
          data-testid="editor-option-toc"
          onSelect={openOutlinePanel}
        >
          {t['com.affine.header.option.view-toc']()}
        </MenuItem>
      ) : (
        <MenuItem
          prefixIcon={<FrameIcon />}
          data-testid="editor-option-frame"
          onSelect={openAllFrames}
        >
          {t['com.affine.header.option.view-frame']()}
        </MenuItem>
      )}
      <MenuSeparator />
      {!isJournal && (
        <MenuItem
          prefixIcon={<DuplicateIcon />}
          data-testid="editor-option-menu-duplicate"
          onSelect={handleDuplicate}
        >
          {t['com.affine.header.option.duplicate']()}
        </MenuItem>
      )}
      <MenuItem
        prefixIcon={<ImportIcon />}
        data-testid="editor-option-menu-import"
        onSelect={handleOpenImportModal}
      >
        {t['Import']()}
      </MenuItem>
      <Export exportHandler={exportHandler} pageMode={currentMode} />
      <MenuSeparator />
      <MoveToTrash
        data-testid="editor-option-menu-delete"
        onSelect={handleOpenTrashModal}
        disabled={!canMoveToTrash}
      />
    </>
  );
};
