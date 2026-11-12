import {
  readString,
  type ToolArgs,
} from '@affine/core/modules/mcp-bridge/tools/args';
import {
  type McpToolDefinition,
  type ToolContext,
  withDoc,
} from '@affine/core/modules/mcp-bridge/tools/context';

import { analyzeSpec } from './analyze';
import { SystemDiagramFlavour } from './model';
import {
  createSampleSpec,
  type DiagramSpec,
  LIMITS,
  NODE_TYPES,
  normalizeSpec,
  TRAFFIC_PROFILES,
  TYPE_DEFAULTS,
} from './spec';

const SPEC_SCHEMA = {
  type: 'object',
  description:
    'Diagram spec. Traffic enters at "client" nodes and flows along edges; a node serves at most replicas x capacityRps, the rest is dropped.',
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: [...NODE_TYPES] },
          label: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          replicas: { type: 'integer' },
          capacityRps: { type: 'number' },
          latencyMs: { type: 'number' },
          hitRatio: { type: 'number', description: 'cache/cdn only, 0-1' },
        },
        required: ['type'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          weight: { type: 'number' },
          label: { type: 'string' },
        },
        required: ['from', 'to'],
      },
    },
    traffic: {
      type: 'object',
      properties: {
        rps: { type: 'number' },
        profile: { type: 'string', enum: [...TRAFFIC_PROFILES] },
        durationSec: { type: 'number' },
      },
    },
  },
  required: ['nodes', 'edges'],
};

function readSpec(args: ToolArgs, key = 'spec'): DiagramSpec {
  const raw = args[key];
  if (typeof raw === 'string') {
    try {
      return normalizeSpec(JSON.parse(raw));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`"${key}" không phải JSON hợp lệ`);
      }
      throw error;
    }
  }
  return normalizeSpec(raw);
}

export function createSystemDiagramTools(
  ctx: ToolContext
): McpToolDefinition[] {
  return [
    {
      name: 'system_diagram_guide',
      write: false,
      description:
        'How the system-design diagram block works: component types with their default capacity and latency, the spec format and an example. Read this before designing a diagram.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({
        howItWorks:
          'A diagram is a DAG. Requests enter at client nodes, split along edges by weight, and each node serves at most replicas x capacityRps requests per second. Caches and CDNs answer hitRatio of requests themselves and forward only the misses. Overload shows up as rising latency first, then dropped requests. Use simulate_system_diagram to check a design, then create_system_diagram to place it in a document.',
        nodeTypes: Object.fromEntries(
          NODE_TYPES.map(type => [
            type,
            {
              defaultLabel: TYPE_DEFAULTS[type].label,
              capacityRpsPerReplica: TYPE_DEFAULTS[type].capacityRps,
              latencyMs: TYPE_DEFAULTS[type].latencyMs,
              ...(TYPE_DEFAULTS[type].hitRatio !== undefined
                ? { hitRatio: TYPE_DEFAULTS[type].hitRatio }
                : {}),
            },
          ])
        ),
        limits: LIMITS,
        layout:
          'x grows to the right, y downwards; keep about 180px between columns and 140px between rows.',
        example: createSampleSpec(),
      }),
    },
    {
      name: 'simulate_system_diagram',
      write: false,
      description:
        'Run the traffic simulation on a diagram spec without touching any document. Returns success rate, latency, the bottleneck, per-node load and, for overloaded tiers, a suggested replica count. Use it to iterate on a design.',
      inputSchema: {
        type: 'object',
        properties: {
          spec: SPEC_SCHEMA,
          rps: {
            type: 'number',
            description: 'Override the requests per second of the spec',
          },
        },
        required: ['spec'],
      },
      handler: async args => {
        const spec = readSpec(args);
        const rps = typeof args.rps === 'number' ? args.rps : undefined;
        return analyzeSpec(spec, rps);
      },
    },
    {
      name: 'create_system_diagram',
      write: true,
      description:
        'Add a system-design diagram block to the end of an existing document. The spec is validated (and repaired where possible); the result includes a simulation summary so you can see how the design behaves.',
      inputSchema: {
        type: 'object',
        properties: {
          docId: { type: 'string' },
          title: { type: 'string' },
          spec: SPEC_SCHEMA,
        },
        required: ['docId', 'spec'],
      },
      handler: async args => {
        const docId = readString(args, 'docId', { required: true }) as string;
        const title = readString(args, 'title', { max: 200 }) ?? '';
        const spec = readSpec(args);
        const blockId = await withDoc(ctx, docId, doc => {
          const store = doc.blockSuiteDoc;
          let noteId = store.getBlocksByFlavour('affine:note')[0]?.id;
          if (!noteId) {
            const pageId = store.getBlocksByFlavour('affine:page')[0]?.id;
            if (!pageId) throw new Error('Tài liệu không có khối trang');
            noteId = store.addBlock('affine:note', {}, pageId);
          }
          return store.addBlock(
            SystemDiagramFlavour as never,
            { title, spec },
            noteId
          );
        });
        return { docId, blockId, analysis: analyzeSpec(spec) };
      },
    },
    {
      name: 'get_system_diagram',
      write: false,
      description:
        'Read the system-design diagrams in a document: block id, title and spec. Pass blockId to read just one.',
      inputSchema: {
        type: 'object',
        properties: { docId: { type: 'string' }, blockId: { type: 'string' } },
        required: ['docId'],
      },
      handler: async args => {
        const docId = readString(args, 'docId', { required: true }) as string;
        const blockId = readString(args, 'blockId');
        return withDoc(ctx, docId, doc => {
          const blocks = doc.blockSuiteDoc
            .getBlocksByFlavour(SystemDiagramFlavour)
            .filter(block => !blockId || block.id === blockId);
          return blocks.map(block => {
            const props = (
              block.model as unknown as {
                props: { title?: string; spec?: unknown };
              }
            ).props;
            return {
              blockId: block.id,
              title: props.title ?? '',
              spec: JSON.parse(JSON.stringify(props.spec ?? {})),
            };
          });
        });
      },
    },
    {
      name: 'update_system_diagram',
      write: true,
      description:
        'Replace the spec (and optionally the title) of an existing diagram block. Send the whole new spec, e.g. after changing replicas or adding a cache.',
      inputSchema: {
        type: 'object',
        properties: {
          docId: { type: 'string' },
          blockId: { type: 'string' },
          title: { type: 'string' },
          spec: SPEC_SCHEMA,
        },
        required: ['docId', 'blockId', 'spec'],
      },
      handler: async args => {
        const docId = readString(args, 'docId', { required: true }) as string;
        const blockId = readString(args, 'blockId', {
          required: true,
        }) as string;
        const title = readString(args, 'title', { max: 200 });
        const spec = readSpec(args);
        await withDoc(ctx, docId, doc => {
          const store = doc.blockSuiteDoc;
          const block = store
            .getBlocksByFlavour(SystemDiagramFlavour)
            .find(b => b.id === blockId);
          if (!block) throw new Error(`Không thấy sơ đồ "${blockId}"`);
          store.updateBlock(block.model, {
            spec,
            ...(title !== undefined ? { title } : {}),
          } as never);
        });
        return { docId, blockId, analysis: analyzeSpec(spec) };
      },
    },
  ];
}
