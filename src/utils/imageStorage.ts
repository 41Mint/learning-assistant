import { IMAGE_STORE as STORE, openAssetDatabase as openDatabase, transactAssets } from './assetDatabase';

export interface StoredImage {
  id: string;
  name: string;
  blob: Blob;
}

export const IMAGE_PREFIX = 'learning-image:';

export function referencedImageIds(content: string): string[] {
  return [...content.matchAll(/learning-image:([a-zA-Z0-9-]+)/g)].map((match) => match[1]);
}

export async function prepareImageFile(file: File): Promise<StoredImage> {
  const name = file.name || '截图';
  if (file.size > 10 * 1024 * 1024) throw new Error(`图片 ${name} 超过 10 MB，请缩小后重试。`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = String.fromCharCode(...bytes.slice(0, 12));
  const type = header.startsWith('\x89PNG\r\n\x1a\n') ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
    : /^GIF8[79]a/.test(header) ? 'image/gif'
    : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!type) throw new Error(`${name} 不是支持的 PNG、JPEG、GIF 或 WebP 图片。`);
  return { id: crypto.randomUUID(), name, blob: new Blob([bytes], { type }) };
}

export function imageMarkdown(id: string, alt: string): string {
  return `![${alt.replace(/[[\]\\]/g, '\\$&')}](${IMAGE_PREFIX}${id})`;
}

export async function getImages(): Promise<StoredImage[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).getAll();
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(id);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function writeImages(images: StoredImage[], replace = false): Promise<void> {
  return transactAssets([STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(STORE);
    if (replace) store.clear();
    for (const image of images) store.put(image);
    return () => undefined;
  });
}

function deleteImages(ids: string[]): Promise<void> {
  return transactAssets([STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(STORE);
    for (const id of ids) store.delete(id);
    return () => undefined;
  });
}

export async function saveWithImages(images: StoredImage[], save: () => void): Promise<void> {
  if (images.length) await writeImages(images);
  try {
    save();
  } catch (error) {
    if (images.length) {
      try { await deleteImages(images.map(({ id }) => id)); }
      catch { throw new Error('学习记录未保存，暂存图片清理失败，请重试。', { cause: error }); }
    }
    throw error;
  }
}
