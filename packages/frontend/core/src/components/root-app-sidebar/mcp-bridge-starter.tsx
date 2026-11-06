import { McpBridgeService } from '@affine/core/modules/mcp-bridge';
import { useService } from '@toeverything/infra';
import { useEffect } from 'react';

/** Connects the MCP bridge for the open workspace (no-op unless enabled). */
export const McpBridgeStarter = () => {
  const bridge = useService(McpBridgeService);

  useEffect(() => {
    bridge.start();
  }, [bridge]);

  return null;
};
