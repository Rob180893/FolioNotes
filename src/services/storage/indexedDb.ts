export const FOLIO_DB_NAME = 'folionotes_db';
export const FOLIO_DB_VERSION = 2;
export const WORKSPACE_STORE = 'workspace';
export const PDF_STORE = 'pdfs';

export function openFolioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB indisponível.'));
      return;
    }
    const request = window.indexedDB.open(FOLIO_DB_NAME, FOLIO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE);
      }
      if (!db.objectStoreNames.contains(PDF_STORE)) {
        db.createObjectStore(PDF_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erro ao abrir IndexedDB.'));
  });
}
