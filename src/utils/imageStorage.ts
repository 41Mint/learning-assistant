import { IMAGE_STORE as STORE, openAssetDatabase as openDatabase } from './assetDatabase';

export interface StoredImage {
  id: string;
  name: string;
  blob: Blob;
}

export const IMAGE_PREFIX = 'learning-image:';

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

export async function writeImages(images: StoredImage[], replace = false): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      if (replace) store.clear();
      images.forEach((image) => store.put(image));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('图片保存失败，可能是浏览器存储空间不足。'));
      transaction.onerror = () => reject(new Error('图片保存失败，请重试。'));
    });
  } finally {
    database.close();
  }
}

export async function deleteImages(ids: string[]): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      ids.forEach((id) => transaction.objectStore(STORE).delete(id));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
