export { TodoInboxService } from './services/todo-inbox';
export { TodoInboxView } from './view/todo-inbox';

import { type Framework } from '@toeverything/infra';

import { DocsService } from '../doc';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { TodoInboxService } from './services/todo-inbox';

export function configureTodoInboxModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(TodoInboxService, [WorkspaceService, DocsService]);
}
