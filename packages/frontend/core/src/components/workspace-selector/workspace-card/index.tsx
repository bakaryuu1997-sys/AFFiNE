import { Button, notify, Skeleton, Tooltip } from '@affine/component';
import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import {
  type WorkspaceMetadata,
  WorkspacesService,
} from '@affine/core/modules/workspace';
import { UNTITLED_WORKSPACE_NAME } from '@affine/env/constant';
import { useI18n } from '@affine/i18n';
import {
  ArrowDownSmallIcon,
  CollaborationIcon,
  DoneIcon,
  SettingsIcon,
  TeamWorkspaceIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { useAsyncCallback } from '../../hooks/affine-async-hooks';
import { useCatchEventCallback } from '../../hooks/use-catch-event-hook';
import { useNavigateHelper } from '../../hooks/use-navigate-helper';
import { WorkspaceAvatar } from '../../workspace-avatar';
import * as styles from './styles.css';
export { PureWorkspaceCard } from './pure-workspace-card';

export const WorkspaceCard = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    workspaceMetadata: WorkspaceMetadata;
    showArrowDownIcon?: boolean;
    avatarSize?: number;
    disable?: boolean;
    hideCollaborationIcon?: boolean;
    hideTeamWorkspaceIcon?: boolean;
    active?: boolean;
    infoClassName?: string;
    dense?: boolean;
    onClickOpenSettings?: (workspaceMetadata: WorkspaceMetadata) => void;
  }
>(
  (
    {
      workspaceMetadata,
      showArrowDownIcon,
      onClickOpenSettings,
      className,
      infoClassName,
      disable,
      hideCollaborationIcon,
      hideTeamWorkspaceIcon,
      active,
      dense,
      avatarSize = dense ? 20 : 32,
      ...props
    },
    ref
  ) => {
    const t = useI18n();
    const information = useWorkspaceInfo(workspaceMetadata);
    const workspacesService = useService(WorkspacesService);
    const navigate = useNavigateHelper();

    const name = information?.name ?? UNTITLED_WORKSPACE_NAME;

    const onRemoveWorkspace = useAsyncCallback(async () => {
      await workspacesService
        .deleteWorkspace(workspaceMetadata)
        .then(() => {
          notify.success({ title: t['Successfully removed workspace']() });
          navigate.jumpToIndex();
        })
        .catch(() => {
          notify.error({ title: t['Failed to remove workspace']() });
        });
    }, [workspacesService, workspaceMetadata, t, navigate]);

    const onOpenSettings = useCatchEventCallback(() => {
      onClickOpenSettings?.(workspaceMetadata);
    }, [onClickOpenSettings, workspaceMetadata]);

    return (
      <div
        className={clsx(
          styles.container,
          disable ? styles.disable : null,
          className
        )}
        role="button"
        tabIndex={0}
        data-testid="workspace-card"
        ref={ref}
        {...props}
      >
        <div className={clsx(styles.infoContainer, infoClassName)}>
          {information ? (
            <WorkspaceAvatar
              className={styles.avatar}
              meta={workspaceMetadata}
              rounded={3}
              data-testid="workspace-avatar"
              size={avatarSize}
              name={name}
              colorfulFallback
            />
          ) : (
            <Skeleton width={avatarSize} height={avatarSize} />
          )}
          <div className={styles.workspaceTitleContainer}>
            {information ? (
              <span className={styles.workspaceName}>{information.name}</span>
            ) : (
              <Skeleton width={100} />
            )}
          </div>
          {information?.isEmpty && information.isOwner ? (
            <Button onClick={onRemoveWorkspace}>Remove</Button>
          ) : null}
          <div className={styles.showOnCardHover}>
            {onClickOpenSettings && (
              <div className={styles.settingButton} onClick={onOpenSettings}>
                <SettingsIcon width={16} height={16} />
              </div>
            )}
          </div>
        </div>

        <div className={styles.suffixIcons}>
          {hideCollaborationIcon || information?.isOwner ? null : (
            <Tooltip
              content={t['com.affine.settings.workspace.state.joined']()}
            >
              <CollaborationIcon className={styles.collaborationIcon} />
            </Tooltip>
          )}
          {hideTeamWorkspaceIcon || !information?.isTeam ? null : (
            <Tooltip content={t['com.affine.settings.workspace.state.team']()}>
              <TeamWorkspaceIcon className={styles.collaborationIcon} />
            </Tooltip>
          )}
          {active && (
            <div className={styles.activeContainer}>
              <DoneIcon className={styles.activeIcon} />
            </div>
          )}
          {showArrowDownIcon && <ArrowDownSmallIcon />}
        </div>
      </div>
    );
  }
);

WorkspaceCard.displayName = 'WorkspaceCard';
