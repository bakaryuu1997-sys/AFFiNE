import {
  type StoreExtensionContext,
  StoreExtensionProvider,
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine/ext-loader';
import { BlockViewExtension, FlavourExtension } from '@blocksuite/affine/std';
import {
  type SlashMenuConfig,
  SlashMenuConfigExtension,
} from '@blocksuite/affine/widgets/slash-menu';
import { ConnectorCIcon } from '@blocksuite/icons/lit';
import { literal } from 'lit/static-html.js';

import { SystemDiagramBlockComponent } from './block';
import {
  SystemDiagramBlockSchemaExtension,
  SystemDiagramFlavour,
} from './model';
import { createSampleSpec } from './spec';
import { S } from './strings';

const TAG = 'system-diagram-block';

const slashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: S.slashName,
      description: S.slashDescription,
      icon: ConnectorCIcon(),
      searchAlias: [
        'system',
        'diagram',
        'architecture',
        'so do',
        'kien truc',
        'ha tang',
      ],
      group: '0_Basic@10',
      when: ({ model }) =>
        model.store.getParent(model)?.flavour === 'affine:note',
      action: ({ model }) => {
        const { store } = model;
        const parent = store.getParent(model);
        if (!parent) return;
        const index = parent.children.indexOf(model);
        if (index === -1) return;
        store.addBlock(
          SystemDiagramFlavour as never,
          { title: S.untitled, spec: createSampleSpec() },
          parent,
          index + 1
        );
      },
    },
  ],
};

export class SystemDiagramStoreExtension extends StoreExtensionProvider {
  override name = 'affine-system-diagram-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(SystemDiagramBlockSchemaExtension);
  }
}

export class SystemDiagramViewExtension extends ViewExtensionProvider {
  override name = 'affine-system-diagram-block';

  override effect() {
    super.effect();
    if (!customElements.get(TAG)) {
      customElements.define(TAG, SystemDiagramBlockComponent);
    }
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension(SystemDiagramFlavour),
      BlockViewExtension(SystemDiagramFlavour, literal`system-diagram-block`),
      SlashMenuConfigExtension(SystemDiagramFlavour, slashMenuConfig),
    ]);
  }
}
