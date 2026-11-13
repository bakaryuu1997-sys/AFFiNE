import { Button, Input, Switch } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';

import { McpBridgeService } from '../services/mcp-bridge';
import { updateMcpBridgeSettings, useMcpBridgeSettings } from '../settings';
import { isTauri } from '../tauri';

export const McpBridgePanel = () => {
  const t = useI18n();
  const settings = useMcpBridgeSettings();
  const bridge = useService(McpBridgeService);
  const status = useLiveData(bridge.status$);
  const audit = useLiveData(bridge.audit$);
  // inside the desktop app the bridge, its address and its token are managed
  // by the app, so there is nothing to type or paste
  const managedByApp = isTauri();

  return (
    <>
      <SettingRow
        name={t['com.affine.mcpBridge.title']()}
        desc={t['com.affine.mcpBridge.description']()}
      >
        <Switch
          checked={settings.enabled}
          onChange={enabled => updateMcpBridgeSettings({ enabled })}
          data-testid="mcp-bridge-enabled"
        />
      </SettingRow>
      <SettingRow
        name={t['com.affine.mcpBridge.status']()}
        desc={t['com.affine.mcpBridge.statusHint']()}
      >
        <span data-testid="mcp-bridge-status">
          {t[`com.affine.mcpBridge.status.${status}`]()}
        </span>
      </SettingRow>
      {managedByApp ? (
        <SettingRow
          name={t['com.affine.mcpBridge.desktop.title']()}
          desc={t['com.affine.mcpBridge.desktop.hint']()}
          spreadCol={false}
        >
          <div
            data-testid="mcp-bridge-desktop"
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              userSelect: 'text',
            }}
          >
            <div>{t['com.affine.mcpBridge.desktop.stdio']()}</div>
            <div>{t['com.affine.mcpBridge.desktop.http']()}</div>
            <div>{t['com.affine.mcpBridge.desktop.tokenFile']()}</div>
          </div>
        </SettingRow>
      ) : (
        <>
          <SettingRow
            name={t['com.affine.mcpBridge.url']()}
            desc={t['com.affine.mcpBridge.urlHint']()}
          >
            <Input
              style={{ width: 280 }}
              value={settings.url}
              onChange={url => updateMcpBridgeSettings({ url: url.trim() })}
              data-testid="mcp-bridge-url"
            />
          </SettingRow>
          <SettingRow
            name={t['com.affine.mcpBridge.token']()}
            desc={t['com.affine.mcpBridge.tokenHint']()}
          >
            <Input
              type="password"
              autoComplete="off"
              style={{ width: 280 }}
              value={settings.token}
              onChange={token =>
                updateMcpBridgeSettings({ token: token.trim() })
              }
              data-testid="mcp-bridge-token"
            />
          </SettingRow>
        </>
      )}
      <SettingRow
        name={t['com.affine.mcpBridge.write']()}
        desc={t['com.affine.mcpBridge.writeHint']()}
      >
        <Switch
          checked={settings.writeEnabled}
          onChange={writeEnabled => updateMcpBridgeSettings({ writeEnabled })}
          data-testid="mcp-bridge-write"
        />
      </SettingRow>
      <SettingRow
        name={t['com.affine.mcpBridge.audit']()}
        desc={t['com.affine.mcpBridge.auditHint']()}
      >
        <Button
          onClick={() => bridge.clearAudit()}
          disabled={audit.length === 0}
        >
          {t['com.affine.mcpBridge.auditClear']()}
        </Button>
      </SettingRow>
      {audit.length > 0 ? (
        <div
          data-testid="mcp-bridge-audit"
          style={{
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {audit.slice(0, 15).map(entry => (
            <div key={entry.id} style={{ display: 'flex', gap: 8 }}>
              <span>{new Date(entry.time).toLocaleTimeString()}</span>
              <strong>{entry.tool}</strong>
              <span>
                {t[`com.affine.mcpBridge.outcome.${entry.outcome}`]()}
              </span>
              <span
                style={{
                  opacity: 0.7,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {entry.message ?? entry.args}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
};
