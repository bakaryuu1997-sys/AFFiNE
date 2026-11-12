import {
  BlockMarkdownAdapterExtension,
  type BlockMarkdownAdapterMatcher,
  type MarkdownAST,
} from '@blocksuite/affine/shared/adapters';
import { nanoid } from '@blocksuite/affine/store';

import {
  decodeDiagram,
  DIAGRAM_MARKDOWN_LANG,
  encodeDiagram,
} from './markdown-payload';
import { SystemDiagramFlavour } from './model';

const isDiagramNode = (node: MarkdownAST) =>
  node.type === 'code' &&
  (node as { lang?: string | null }).lang === DIAGRAM_MARKDOWN_LANG;

/**
 * Exports a diagram as a ```system-diagram fenced block and reads such a block
 * back. The code block adapter skips this language (see its toMatch), so a
 * diagram does not also turn into a code block.
 */
export const systemDiagramMarkdownMatcher: BlockMarkdownAdapterMatcher = {
  flavour: SystemDiagramFlavour,
  toMatch: o => isDiagramNode(o.node),
  fromMatch: o => o.node.flavour === SystemDiagramFlavour,
  toBlockSnapshot: {
    enter: (o, context) => {
      if (!isDiagramNode(o.node)) return;
      const { title, spec } = decodeDiagram(
        String((o.node as { value?: string }).value ?? '')
      );
      context.walkerContext
        .openNode(
          {
            type: 'block',
            id: nanoid(),
            flavour: SystemDiagramFlavour,
            props: { title, spec },
            children: [],
          },
          'children'
        )
        .closeNode();
    },
  },
  fromBlockSnapshot: {
    enter: (o, context) => {
      context.walkerContext
        .openNode(
          {
            type: 'code',
            lang: DIAGRAM_MARKDOWN_LANG,
            meta: null,
            value: encodeDiagram(
              String(o.node.props.title ?? ''),
              o.node.props.spec
            ),
          },
          'children'
        )
        .closeNode();
    },
  },
};

export const SystemDiagramMarkdownAdapterExtension =
  BlockMarkdownAdapterExtension(systemDiagramMarkdownMatcher);
