import type { Framework } from '@toeverything/infra';

import { WorkspaceDBService } from '../db';
import { DocsService } from '../doc';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { TemplateDocList } from './entities/list';
import { TemplateDocSetting } from './entities/setting';
import { BuiltinTemplatesService } from './services/builtin-templates';
import { TemplateDocService } from './services/template-doc';
import { TemplateDocListStore } from './store/list';
import { TemplateDocSettingStore } from './store/setting';

export { BuiltinTemplatesService, TemplateDocService };

export const configureTemplateDocModule = (framework: Framework) => {
  framework
    .scope(WorkspaceScope)
    .service(TemplateDocService)
    .service(BuiltinTemplatesService, [WorkspaceService, DocsService])
    .store(TemplateDocListStore, [WorkspaceDBService])
    .entity(TemplateDocList, [TemplateDocListStore, DocsService])
    .store(TemplateDocSettingStore, [WorkspaceDBService])
    .entity(TemplateDocSetting, [TemplateDocSettingStore]);
};
