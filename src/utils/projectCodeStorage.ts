import type { ProjectCodeData } from '../types/projectCode';
import type { StoredImage } from './imageStorage';
import { IMAGE_STORE, PROJECT_CODE_STORE, transactAssets } from './assetDatabase';
import { emptyProjectCode, validateProjectCode } from './projectCode';

const LIBRARY_KEY = 'library';

function storedProjectCode(value: unknown): ProjectCodeData {
  return value === undefined ? emptyProjectCode() : validateProjectCode(value);
}

export function readProjectCode(): Promise<ProjectCodeData> {
  return transactAssets([PROJECT_CODE_STORE], 'readonly', (transaction) => {
    const request = transaction.objectStore(PROJECT_CODE_STORE).get(LIBRARY_KEY);
    return () => storedProjectCode(request.result);
  });
}

export function updateProjectCode(edit: (data: ProjectCodeData) => ProjectCodeData): Promise<ProjectCodeData> {
  return transactAssets([PROJECT_CODE_STORE], 'readwrite', (transaction, abort) => {
    const store = transaction.objectStore(PROJECT_CODE_STORE);
    const request = store.get(LIBRARY_KEY);
    let next: ProjectCodeData;
    request.onsuccess = () => {
      try {
        next = validateProjectCode(edit(storedProjectCode(request.result)));
        store.put(next, LIBRARY_KEY);
      } catch (error) {
        abort(error);
      }
    };
    return () => next;
  });
}

export function readBackupAssets(): Promise<{ images: StoredImage[]; projectCode: ProjectCodeData }> {
  return transactAssets([IMAGE_STORE, PROJECT_CODE_STORE], 'readonly', (transaction) => {
    const images = transaction.objectStore(IMAGE_STORE).getAll();
    const code = transaction.objectStore(PROJECT_CODE_STORE).get(LIBRARY_KEY);
    return () => ({ images: images.result, projectCode: storedProjectCode(code.result) });
  });
}

export function replaceBackupAssets(images: StoredImage[], projectCode: ProjectCodeData): Promise<void> {
  return transactAssets([IMAGE_STORE, PROJECT_CODE_STORE], 'readwrite', (transaction) => {
    const imageStore = transaction.objectStore(IMAGE_STORE);
    imageStore.clear();
    images.forEach((image) => imageStore.put(image));
    transaction.objectStore(PROJECT_CODE_STORE).put(projectCode, LIBRARY_KEY);
    return () => undefined;
  });
}
