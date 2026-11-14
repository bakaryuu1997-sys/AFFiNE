import { BlocksuiteHeaderTitle } from '@affine/core/blocksuite/block-suite-header/title';
import { EditorModeSwitch } from '@affine/core/blocksuite/block-suite-mode-switch';
import type { DocMode } from '@blocksuite/affine/model';

import * as styles from './share-header.css';

export function ShareHeader({
  pageId: _pageId,
  publishMode: _publishMode,
  isTemplate: _isTemplate,
  templateName: _templateName,
  snapshotUrl: _snapshotUrl,
}: {
  pageId: string;
  publishMode: DocMode;
  isTemplate?: boolean;
  templateName?: string;
  snapshotUrl?: string;
}) {
  return (
    <div className={styles.header}>
      <EditorModeSwitch />
      <BlocksuiteHeaderTitle />
      <div className={styles.spacer} />
    </div>
  );
}
