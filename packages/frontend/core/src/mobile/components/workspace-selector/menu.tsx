import { IconButton } from '@affine/component';
import {
  RouteLogic,
  useNavigateHelper,
} from '@affine/core/components/hooks/use-navigate-helper';
import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import { WorkspaceAvatar } from '@affine/core/components/workspace-avatar';
import { GlobalContextService } from '@affine/core/modules/global-context';
import {
  type WorkspaceMetadata,
  WorkspacesService,
} from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { CloseIcon, CollaborationIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import { type HTMLAttributes, useCallback, useMemo } from 'react';

import * as styles from './menu.css';

const WorkspaceItem = ({
  workspace,
  className,
  ...attrs
}: { workspace: WorkspaceMetadata } & HTMLAttributes<HTMLButtonElement>) => {
  const info = useWorkspaceInfo(workspace);
  const name = info?.name;
  const isOwner = info?.isOwner;

  return (
    <li className={styles.wsItem}>
      <button className={clsx(styles.wsCard, className)} {...attrs}>
        <WorkspaceAvatar
          key={`${workspace.flavour}:${workspace.id}`}
          meta={workspace}
          rounded={6}
          data-testid="workspace-avatar"
          size={32}
          name={name}
          colorfulFallback
        />
        <div className={styles.wsName}>{name}</div>
        {!isOwner ? <CollaborationIcon fontSize={24} /> : null}
      </button>
    </li>
  );
};

export const SelectorMenu = ({ onClose }: { onClose?: () => void }) => {
  const t = useI18n();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.list.workspaces$);
  const globalContextService = useService(GlobalContextService);
  const { jumpToPage } = useNavigateHelper();

  const currentWorkspaceId = useLiveData(
    globalContextService.globalContext.workspaceId.$
  );

  const localWorkspaces = useMemo(
    () =>
      workspaces.filter(
        ({ flavour }) => flavour === 'local'
      ) as WorkspaceMetadata[],
    [workspaces]
  );

  const handleClickWorkspace = useCallback(
    (workspaceMetadata: WorkspaceMetadata) => {
      const id = workspaceMetadata.id;
      if (id !== currentWorkspaceId) {
        void jumpToPage(id, 'home', RouteLogic.PUSH);
      }
      onClose?.();
    },
    [currentWorkspaceId, jumpToPage, onClose]
  );

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        {t['com.affine.workspaceList.workspaceListType.local']()}
        <div className={styles.headActions}>
          <IconButton onClick={onClose} size="24" icon={<CloseIcon />} />
        </div>
      </header>
      <div className={styles.divider} />
      <main className={styles.body}>
        {localWorkspaces.map(item => (
          <WorkspaceItem
            key={`${item.flavour}:${item.id}`}
            workspace={item}
            onClick={() => handleClickWorkspace(item)}
          />
        ))}
      </main>
    </div>
  );
};
