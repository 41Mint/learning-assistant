import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { IMAGE_PREFIX } from './imageStorage';
import type { StoredImage } from './imageStorage';

interface MarkdownNode {
  type: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  identifier?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

export interface PreparedImport {
  content: string;
  images: StoredImage[];
  missing: string[];
  localImageCount: number;
}

function walk(node: MarkdownNode, callback: (node: MarkdownNode) => void) {
  callback(node);
  node.children?.forEach((child) => walk(child, callback));
}

function normalizePath(path: string) {
  try { path = decodeURIComponent(path); } catch { /* 保留非 URL 编码的原始文件名。 */ }
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

export async function prepareMarkdownImport(markdown: string, files: File[]): Promise<PreparedImport> {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  walk(tree, (node) => {
    if (node.type === 'definition' && node.identifier && node.url) definitions.set(node.identifier, node.url);
  });

  const edits: Array<{ start: number; end: number; value: string }> = [];
  const imagesByFile = new Map<File, StoredImage>();
  const missing = new Set<string>();
  let localImageCount = 0;

  const nodes: MarkdownNode[] = [];
  walk(tree, (node) => {
    if (node.type === 'image' || node.type === 'imageReference') nodes.push(node);
  });
  for (const node of nodes) {
    const url = node.url ?? definitions.get(node.identifier ?? '');
    if (!url || /^(https?:\/\/|learning-image:)/i.test(url)) continue;
    localImageCount += 1;
    const path = normalizePath(url);
    const candidates = files.filter((file) => {
      const filePath = normalizePath(file.webkitRelativePath || file.name);
      return filePath === path || filePath.endsWith(`/${path}`);
    });
    const matches = candidates.length ? candidates : files.filter((file) => file.name === path.split('/').at(-1));
    if (matches.length !== 1) {
      missing.add(`${url}${matches.length > 1 ? '（有同名文件，请只选择对应图片）' : ''}`);
      continue;
    }
    const file = matches[0];
    let image = imagesByFile.get(file);
    if (!image) {
      if (file.size > 10 * 1024 * 1024) throw new Error(`图片 ${file.name} 超过 10 MB，请缩小后再导入。`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const header = Array.from(bytes.slice(0, 12), (byte) => String.fromCharCode(byte)).join('');
      const type = header.startsWith('\x89PNG\r\n\x1a\n') ? 'image/png'
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
        : /^GIF8[79]a/.test(header) ? 'image/gif'
        : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP' ? 'image/webp' : null;
      if (!type) throw new Error(`${file.name} 不是支持的 PNG、JPEG、GIF 或 WebP 图片。`);
      image = { id: crypto.randomUUID(), name: file.name, blob: new Blob([bytes], { type }) };
      imagesByFile.set(file, image);
    }
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start !== undefined && end !== undefined) {
      const alt = (node.alt ?? '').replace(/[[\]\\]/g, '\\$&');
      edits.push({ start, end, value: `![${alt}](${IMAGE_PREFIX}${image.id})` });
    }
  }
  let content = markdown;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    content = content.slice(0, edit.start) + edit.value + content.slice(edit.end);
  }
  return { content, images: [...imagesByFile.values()], missing: [...missing], localImageCount };
}
