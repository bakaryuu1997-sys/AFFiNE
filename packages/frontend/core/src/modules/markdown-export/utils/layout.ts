export interface ExportDoc {
  id: string;
  title: string;
  markdown: string;
  assets: { name: string; blob: Blob }[];
}

export interface ExportFile {
  path: string;
  content: string | Blob;
}

const FORBIDDEN = /[<>:"/\\|?*]/g;

function stripControlChars(value: string) {
  return Array.from(value, char => (char.charCodeAt(0) < 32 ? ' ' : char)).join(
    ''
  );
}
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** Turns a doc title into a file name that is valid on Windows, macOS, Linux. */
export function sanitizeFileName(title: string): string {
  let name = stripControlChars(title)
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Windows drops trailing dots and spaces
  name = name.replace(/[. ]+$/, '');
  if (name.length > 120) name = name.slice(0, 120).trim();
  if (!name) name = 'Untitled';
  if (RESERVED.test(name)) name = `_${name}`;
  return name;
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

/**
 * Lays docs out as files. A doc without attachments becomes `Title.md`; a doc
 * with attachments becomes `Title/index.md` plus `Title/assets/*`, which is the
 * layout BlockSuite's own single-doc export uses. Names are made unique
 * case-insensitively.
 */
export function layoutMarkdownFiles(docs: ExportDoc[]): ExportFile[] {
  const used = new Set<string>();
  const files: ExportFile[] = [];

  const unique = (base: string) => {
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
      name = `${base} (${n++})`;
    }
    used.add(name.toLowerCase());
    return name;
  };

  for (const doc of docs) {
    const name = unique(sanitizeFileName(doc.title));
    const body = `---\ntitle: ${yamlString(doc.title)}\nid: ${yamlString(doc.id)}\n---\n\n${doc.markdown}`;
    if (doc.assets.length === 0) {
      files.push({ path: `${name}.md`, content: body });
    } else {
      files.push({ path: `${name}/index.md`, content: body });
      for (const asset of doc.assets) {
        files.push({
          path: `${name}/assets/${asset.name}`,
          content: asset.blob,
        });
      }
    }
  }
  return files;
}
