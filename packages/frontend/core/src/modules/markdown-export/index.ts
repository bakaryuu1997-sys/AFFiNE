export {
  type MarkdownExportProgress,
  type MarkdownExportResult,
  MarkdownExportService,
} from './services/markdown-export';

import { type Framework } from '@toeverything/infra';

import { DocsService } from '../doc';
import { TemplateDocService } from '../template-doc';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { MarkdownExportService } from './services/markdown-export';

export function configureMarkdownExportModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(MarkdownExportService, [
      WorkspaceService,
      DocsService,
      TemplateDocService,
    ]);
}
