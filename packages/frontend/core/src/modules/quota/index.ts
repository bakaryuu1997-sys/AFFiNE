export { WorkspaceQuotaService } from './services/quota';

import { type Framework } from '@toeverything/infra';

import { NbstoreService } from '../storage';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { WorkspaceQuota } from './entities/quota';
import { WorkspaceQuotaService } from './services/quota';
import { WorkspaceQuotaStore } from './stores/quota';

export function configureQuotaModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(WorkspaceQuotaService)
    .store(WorkspaceQuotaStore, [NbstoreService])
    .entity(WorkspaceQuota, [WorkspaceService, WorkspaceQuotaStore]);
}
