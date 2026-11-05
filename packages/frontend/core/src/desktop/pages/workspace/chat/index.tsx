import { LocalAIChat } from '@affine/core/modules/local-ai';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';

import * as styles from './index.css';

/**
 * "Intelligence" page. The original AFFiNE AI chat depends on the cloud backend;
 * this fork replaces it with a local panel that talks to OpenAI-compatible
 * endpoints (9router, Ollama, ...). See modules/local-ai.
 */
export const Component = () => {
  const t = useI18n();

  return (
    <>
      <ViewTitle title={t['com.affine.workspaceSubPath.chat']()} />
      <ViewIcon icon="ai" />
      <ViewHeader>
        <div className={styles.chatHeader}>
          <strong>{t['com.affine.localAI.title']()}</strong>
        </div>
      </ViewHeader>
      <ViewBody>
        <div className={styles.chatRoot}>
          <LocalAIChat />
        </div>
      </ViewBody>
    </>
  );
};
