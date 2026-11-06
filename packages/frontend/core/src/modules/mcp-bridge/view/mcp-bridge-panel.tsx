import { Button, Input, Switch } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';

import { McpBridgeService } from '../services/mcp-bridge';
import { updateMcpBridgeSettings, useMcpBridgeSettings } from '../settings';

export const McpBridgePanel = () => {
  const t = useI18n();
  const settings = useMcpBridgeSettings();
  const bridge = useService(McpBridgeService);
  const status = useLiveData(bridge.status$);
  const audit = useLiveData(bridge.audit$);

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
          onChange={token => updateMcpBridgeSettings({ token: token.trim() })}
          data-testid="mcp-bridge-token"
        />
      </SettingRow>
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
