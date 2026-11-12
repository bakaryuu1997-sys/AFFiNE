import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blocksuite/affine/store';

import { createEmptySpec } from './spec';

export const SystemDiagramFlavour = 'affine:system-diagram';

export type SystemDiagramProps = {
  title: string;
  /** a DiagramSpec; always read it through normalizeSpec */
  spec: unknown;
};

export const SystemDiagramBlockSchema = defineBlockSchema({
  flavour: SystemDiagramFlavour,
  props: (): SystemDiagramProps => ({
    title: '',
    spec: createEmptySpec(),
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['affine:note'],
    children: [],
  },
  toModel: () => new SystemDiagramBlockModel(),
});

export class SystemDiagramBlockModel extends BlockModel<SystemDiagramProps> {}

export const SystemDiagramBlockSchemaExtension = BlockSchemaExtension(
  SystemDiagramBlockSchema
);
