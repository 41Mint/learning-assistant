import { ASSET_DATABASE_NAME } from './workspaceMode';
export const IMAGE_STORE = 'images';
export const PROJECT_CODE_STORE = 'project-code';

export function openAssetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(ASSET_DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE)) database.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(PROJECT_CODE_STORE)) database.createObjectStore(PROJECT_CODE_STORE);
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('浏览器存储正在被旧页面使用。请关闭其他学习助手标签页后刷新。'));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(new Error('无法打开资料存储，请检查浏览器是否允许保存本站数据。'));
  });
}

// 提交后再读取结果。同步异常也中止事务，避免先清空再写入时只完成一半。
export async function transactAssets<T>(
  stores: string[],
  mode: IDBTransactionMode,
  start: (transaction: IDBTransaction, abort: (error: unknown) => void) => () => T,
): Promise<T> {
  const database = await openAssetDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(stores, mode);
      let failure: unknown;
      let result: () => T;
      const abort = (error: unknown) => {
        failure = error;
        transaction.abort();
      };
      transaction.oncomplete = () => {
        try { resolve(result()); } catch (error) { reject(error); }
      };
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('资料存储操作失败。'));
      try { result = start(transaction, abort); } catch (error) { abort(error); }
    });
  } finally {
    database.close();
  }
}
