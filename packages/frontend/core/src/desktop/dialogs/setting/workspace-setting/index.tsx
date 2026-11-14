import type { SettingTab } from '@affine/core/modules/dialogs/constant';
import { useI18n } from '@affine/i18n';
import { PropertyIcon, SaveIcon, SettingsIcon } from '@blocksuite/icons/rc';
import { useMemo } from 'react';

import type { SettingSidebarItem, SettingState } from '../types';
import { McpIntegrationPanel } from './mcp-integration';
import { WorkspaceSettingDetail } from './preference';
import { WorkspaceSettingProperties } from './properties';
import { WorkspaceSettingStorage } from './storage';

export const WorkspaceSetting = ({
  activeTab,
  onCloseSetting,
}: {
  activeTab: SettingTab;
  scrollAnchor?: string;
  onCloseSetting: () => void;
  onChangeSettingState: (settingState: SettingState) => void;
}) => {
  switch (activeTab) {
    case 'workspace:preference':
      return <WorkspaceSettingDetail onCloseSetting={onCloseSetting} />;
    case 'workspace:properties':
      return <WorkspaceSettingProperties />;
    case 'workspace:storage':
      return <WorkspaceSettingStorage />;
    case 'workspace:mcp':
      return <McpIntegrationPanel />;
    default:
      return null;
  }
};

export const useWorkspaceSettingList = (): SettingSidebarItem[] => {
  const t = useI18n();

  const items = useMemo<SettingSidebarItem[]>(() => {
    return [
      {
        key: 'workspace:preference',
        title: t['com.affine.settings.workspace.preferences'](),
        icon: <SettingsIcon />,
        testId: 'workspace-setting:preference',
      },
      {
        key: 'workspace:properties',
        title: t['com.affine.settings.workspace.properties'](),
        icon: <PropertyIcon />,
        testId: 'workspace-setting:properties',
      },
      {
        key: 'workspace:storage',
        title: t['Storage'](),
        icon: <SaveIcon />,
        testId: 'workspace-setting:storage',
      },
      {
        key: 'workspace:mcp',
        title: 'Tích hợp máy chủ MCP',
        icon: (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        ),
        testId: 'workspace-setting:mcp',
      },
    ];
  }, [t]);

  return items;
};
