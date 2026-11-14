import { notify, Switch } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { Button } from '@affine/component/ui/button';
import { McpBridgeService } from '@affine/core/modules/mcp-bridge/services/mcp-bridge';
import {
  updateMcpBridgeSettings,
  useMcpBridgeSettings,
} from '@affine/core/modules/mcp-bridge/settings';
import {
  fetchMcpClientStatuses,
  installMcpClientConfig,
  isTauri,
  type McpClientStatus,
} from '@affine/core/modules/mcp-bridge/tauri';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Custom icons for AI clients
const ClientIcon = ({
  clientId,
  size = 20,
}: {
  clientId: string;
  size?: number;
}) => {
  switch (clientId) {
    case 'claude':
    case 'claude_code':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M16.5 4.5l-4.5 4.5 4.5 4.5M7.5 4.5l4.5 4.5-4.5 4.5M4 19.5h16"
            stroke="#D97757"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'codex':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#10A37F" strokeWidth="2" />
          <path
            d="M12 7v10M7 12h10"
            stroke="#10A37F"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'cursor':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 3l14 8-8 3-3 8L5 3z"
            fill="#3B82F6"
            stroke="#2563EB"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'windsurf':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 14c3-6 6-6 9 0s6 6 9 0M3 9c3-6 6-6 9 0s6 6 9 0"
            stroke="#06B6D4"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'antigravity':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
            stroke="#8B5CF6"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" fill="#A78BFA" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="9" cy="9" r="1.5" fill="currentColor" />
          <circle cx="15" cy="15" r="1.5" fill="currentColor" />
        </svg>
      );
  }
};

export const McpIntegrationPanel = () => {
  const [activeSubTab, setActiveSubTab] = useState<'setup' | 'bridge'>('setup');
  const [clients, setClients] = useState<McpClientStatus[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('claude');
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const bridgeSettings = useMcpBridgeSettings();
  const bridgeService = useService(McpBridgeService);
  const bridgeStatus = useLiveData(bridgeService.status$);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMcpClientStatuses();
      setClients(list);
      if (list.length > 0 && !selectedClientId) {
        setSelectedClientId(list[0].client_id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    loadStatus().catch(console.error);
  }, [loadStatus]);

  const selectedClient = useMemo(
    () => clients.find(c => c.client_id === selectedClientId) ?? clients[0],
    [clients, selectedClientId]
  );

  const handleInstall = useCallback(
    async (clientId: string) => {
      setInstallingId(clientId);
      try {
        const clientName = await installMcpClientConfig(clientId);
        notify.success({
          title: `Đã cài đặt cấu hình ${clientName}`,
          message:
            'Máy chủ MCP của AFFiNE đã được thêm vào cấu hình thành công.',
        });
        await loadStatus();
      } catch (err) {
        notify.error({
          title: 'Cài đặt thất bại',
          message:
            (err as Error)?.message ||
            'Vui lòng kiểm tra quyền ghi tệp cấu hình.',
        });
      } finally {
        setInstallingId(null);
      }
    },
    [loadStatus]
  );

  const previewSnippet = useMemo(() => {
    if (!selectedClient) return '';
    const exe = selectedClient.executable_path || 'affine-personal.exe';
    if (selectedClient.client_type === 'command') {
      return (
        selectedClient.manual_command ||
        `claude mcp add --scope user affine "${exe}" -- --mcp`
      );
    }
    return JSON.stringify(
      {
        mcpServers: {
          affine: {
            command: exe,
            args: ['--mcp'],
          },
        },
      },
      null,
      2
    );
  }, [selectedClient]);

  const handleCopySnippet = useCallback(() => {
    if (!previewSnippet) return;
    navigator.clipboard.writeText(previewSnippet).catch(console.error);
    notify.success({
      title: 'Đã sao chép vào bộ nhớ tạm',
    });
  }, [previewSnippet]);

  return (
    <>
      <SettingHeader
        title="Tích hợp máy chủ MCP"
        subtitle="Kết nối AFFiNE với Claude Desktop, Claude Code, Cursor, Codex, Windsurf, Antigravity và nhiều công cụ khác."
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('setup')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            cursor: 'pointer',
            border:
              activeSubTab === 'setup'
                ? '1px solid var(--affine-primary-color)'
                : '1px solid var(--affine-border-color)',
            background:
              activeSubTab === 'setup'
                ? 'var(--affine-background-primary-color)'
                : 'transparent',
            color:
              activeSubTab === 'setup'
                ? 'var(--affine-primary-color)'
                : 'var(--affine-text-secondary-color)',
          }}
        >
          Thiết lập AI Client
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('bridge')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            cursor: 'pointer',
            border:
              activeSubTab === 'bridge'
                ? '1px solid var(--affine-primary-color)'
                : '1px solid var(--affine-border-color)',
            background:
              activeSubTab === 'bridge'
                ? 'var(--affine-background-primary-color)'
                : 'transparent',
            color:
              activeSubTab === 'bridge'
                ? 'var(--affine-primary-color)'
                : 'var(--affine-text-secondary-color)',
          }}
        >
          Cầu nối cục bộ
        </button>
      </div>

      {activeSubTab === 'setup' && (
        <SettingWrapper>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 340px) 1fr',
              gap: 16,
              width: '100%',
            }}
          >
            {/* Left Column: AI Client List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--affine-text-secondary-color)',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                AI CLIENT
              </div>
              {loading && (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--affine-text-secondary-color)',
                    padding: 12,
                  }}
                >
                  Đang kiểm tra...
                </div>
              )}
              {!loading &&
                clients.map(client => {
                  const isSelected = client.client_id === selectedClientId;
                  const isInstalled = client.installed;
                  return (
                    <div
                      key={client.client_id}
                      onClick={() => setSelectedClientId(client.client_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: isSelected
                          ? '1px solid var(--affine-primary-color)'
                          : '1px solid var(--affine-border-color)',
                        background: isSelected
                          ? 'var(--affine-hover-color)'
                          : 'var(--affine-background-primary-color)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <ClientIcon clientId={client.client_id} size={20} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--affine-text-primary-color)',
                            }}
                          >
                            {client.client_name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--affine-text-secondary-color)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 180,
                            }}
                            title={client.config_path ?? ''}
                          >
                            {client.config_path ?? 'CLI Command'}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isInstalled ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#10B981',
                              background: 'rgba(16, 185, 129, 0.1)',
                              padding: '3px 8px',
                              borderRadius: 999,
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✓ Đã cài đặt
                          </span>
                        ) : (
                          <Button
                            variant="primary"
                            disabled={installingId === client.client_id}
                            onClick={e => {
                              e.stopPropagation();
                              handleInstall(client.client_id).catch(
                                console.error
                              );
                            }}
                          >
                            {installingId === client.client_id
                              ? 'Đang cài...'
                              : 'Cài cấu hình'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Right Column: Preview & Quick Action */}
            {selectedClient && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--affine-border-color)',
                  background: 'var(--affine-background-primary-color)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--affine-border-color)',
                    paddingBottom: 12,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <ClientIcon clientId={selectedClient.client_id} size={24} />
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--affine-text-primary-color)',
                        }}
                      >
                        {selectedClient.client_name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--affine-text-secondary-color)',
                        }}
                      >
                        {selectedClient.config_path ??
                          'Cài đặt tự động qua CLI'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        loadStatus().catch(console.error);
                      }}
                    >
                      🔄 Tải lại
                    </Button>
                    <Button
                      variant="primary"
                      disabled={installingId === selectedClient.client_id}
                      onClick={() => {
                        handleInstall(selectedClient.client_id).catch(
                          console.error
                        );
                      }}
                    >
                      {selectedClient.installed
                        ? 'Cài lại cấu hình'
                        : 'Cài cấu hình ngay'}
                    </Button>
                  </div>
                </div>

                {selectedClient.installed ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      color: '#10B981',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    ✓ Đã phát hiện cấu hình máy chủ AFFiNE MCP trong{' '}
                    {selectedClient.client_name}.
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      color: '#3B82F6',
                      fontSize: 12,
                    }}
                  >
                    Bấm &quot;Cài cấu hình ngay&quot; để tự động cấu hình
                    1-click hoặc sao chép đoạn mã bên dưới.
                  </div>
                )}

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--affine-text-secondary-color)',
                      }}
                    >
                      {selectedClient.client_type === 'command'
                        ? 'Lệnh cấu hình CLI'
                        : 'Cấu hình JSON'}
                    </span>
                    <Button variant="secondary" onClick={handleCopySnippet}>
                      📋{' '}
                      {selectedClient.client_type === 'command'
                        ? 'Sao chép lệnh'
                        : 'Sao chép JSON'}
                    </Button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      fontSize: 12,
                      fontFamily: 'Consolas, Monaco, monospace',
                      borderRadius: 6,
                      background: 'var(--affine-background-secondary-color)',
                      border: '1px solid var(--affine-border-color)',
                      color: 'var(--affine-text-primary-color)',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      userSelect: 'text',
                    }}
                  >
                    {previewSnippet}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </SettingWrapper>
      )}

      {activeSubTab === 'bridge' && (
        <SettingWrapper>
          <SettingRow
            name="Cầu nối MCP"
            desc="Cho phép các agent AI (Claude, Cursor, Antigravity...) tương tác và cập nhật workspace này."
          >
            <Switch
              checked={bridgeSettings.enabled}
              onChange={enabled => updateMcpBridgeSettings({ enabled })}
            />
          </SettingRow>

          <SettingRow
            name="Trạng thái kết nối"
            desc="Trạng thái kết nối giữa ứng dụng AFFiNE và máy chủ cầu nối cục bộ."
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: bridgeStatus === 'connected' ? '#10B981' : '#F59E0B',
              }}
            >
              ●{' '}
              {bridgeStatus === 'connected'
                ? 'Đã kết nối'
                : 'Đang chờ ứng dụng kết nối'}
            </span>
          </SettingRow>

          <SettingRow
            name="Cho phép chỉnh sửa"
            desc="Khi tắt, agent chỉ có thể đọc; các thao tác tạo mới và sửa đổi đều bị chặn."
          >
            <Switch
              checked={bridgeSettings.writeEnabled}
              onChange={writeEnabled =>
                updateMcpBridgeSettings({ writeEnabled })
              }
            />
          </SettingRow>

          <SettingRow
            name="Địa chỉ cầu nối"
            desc="Địa chỉ WebSocket nội bộ mà ứng dụng kết nối tới máy chủ cầu nối."
          >
            <div
              style={{
                fontSize: 13,
                fontFamily: 'monospace',
                color: 'var(--affine-text-primary-color)',
              }}
            >
              {bridgeSettings.url || 'ws://127.0.0.1:20130/bridge'}
            </div>
          </SettingRow>

          {isTauri() && (
            <SettingRow
              name="Tích hợp Desktop"
              desc="Ứng dụng máy tính đã tích hợp sẵn cầu nối MCP Rust bên trong, không cần cài đặt Node.js."
            >
              <div style={{ fontSize: 12, color: '#10B981', fontWeight: 500 }}>
                ✓ Đang quản lý tự động bởi ứng dụng AFFiNE Desktop
              </div>
            </SettingRow>
          )}
        </SettingWrapper>
      )}
    </>
  );
};
