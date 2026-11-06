export { McpBridgeService } from './services/mcp-bridge';
export type { McpToolDefinition } from './tools/context';
export { McpBridgePanel } from './view/mcp-bridge-panel';

import { type Framework } from '@toeverything/infra';

import { DocsService } from '../doc';
import { DocsSearchService } from '../docs-search';
import { TemplateDocService } from '../template-doc';
import { TodoInboxService } from '../todo-inbox';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { McpBridgeService } from './services/mcp-bridge';

export function configureMcpBridgeModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(McpBridgeService, [
      WorkspaceService,
      DocsService,
      TemplateDocService,
      DocsSearchService,
      TodoInboxService,
    ]);
}
