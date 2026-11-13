import 'fake-indexeddb/auto';

import { getStoreManager } from '@affine/core/blocksuite/manager/store';
import { getAFFiNEWorkspaceSchema } from '@affine/core/modules/workspace';
import { TestWorkspace } from '@blocksuite/affine/store/test';
import { MarkdownTransformer } from '@blocksuite/affine/widgets/linked-doc';
import { describe, expect, test } from 'vitest';

import { DIAGRAM_MARKDOWN_LANG, encodeDiagram } from '../markdown-payload';
import { SystemDiagramFlavour } from '../model';
import { createSampleSpec } from '../spec';

describe('importing a system-diagram fence from Markdown', () => {
  test('becomes a diagram block and not a code block', async () => {
    const extensions = getStoreManager().config.init().value.get('store');
    const collection = new TestWorkspace({ id: 'test' });
    collection.storeExtensions = extensions;
    collection.meta.initialize();

    const spec = createSampleSpec();
    const markdown = [
      '```' + DIAGRAM_MARKDOWN_LANG,
      encodeDiagram('Demo', spec),
      '```',
    ].join('\n');

    const docId = await MarkdownTransformer.importMarkdownToDoc({
      collection,
      schema: getAFFiNEWorkspaceSchema(),
      markdown,
      fileName: 'Demo',
      extensions,
    });
    expect(docId).toBeTruthy();

    const store = collection
      .getDoc(docId as string)
      ?.getStore({ id: docId as string });
    expect(store).toBeTruthy();
    expect(store?.getBlocksByFlavour('affine:code')).toHaveLength(0);

    const diagrams = store?.getBlocksByFlavour(SystemDiagramFlavour) ?? [];
    expect(diagrams).toHaveLength(1);
    const props = diagrams[0].model.props as { title: string };
    expect(props.title).toBe('Demo');
  });
});
