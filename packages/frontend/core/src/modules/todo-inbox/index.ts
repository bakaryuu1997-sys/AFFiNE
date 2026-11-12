export { TodoInboxService } from './services/todo-inbox';
export { TodoReminderService } from './services/todo-reminder';
export { TodoInboxView } from './view/todo-inbox';

import { type Framework } from '@toeverything/infra';

import { DocsService } from '../doc';
import { TemplateDocService } from '../template-doc';
import { WorkbenchService } from '../workbench';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { TodoInboxService } from './services/todo-inbox';
import { TodoReminderService } from './services/todo-reminder';

export function configureTodoInboxModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(TodoInboxService, [
      WorkspaceService,
      DocsService,
      TemplateDocService,
    ])
    .service(TodoReminderService, [
      WorkspaceService,
      TodoInboxService,
      WorkbenchService,
    ]);
}
