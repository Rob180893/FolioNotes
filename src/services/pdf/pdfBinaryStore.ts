import { openFolioDb, PDF_STORE } from '../storage/indexedDb';

export interface StoredPdfRecord {
  id: string;
  fileName: string;
  data: ArrayBuffer;
  createdAt: number;
}

export async function savePdfBinary(id: string, fileName: string, data: ArrayBuffer): Promise<void> {
  const db = await openFolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    const store = tx.objectStore(PDF_STORE);
    const record: StoredPdfRecord = {
      id,
      fileName,
      data: data.slice(0),
      createdAt: Date.now(),
    };
    const req = store.put(record, id);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Erro ao salvar PDF no armazenamento local.'));
    };
  });
}

export async function loadPdfBinary(id: string): Promise<StoredPdfRecord | null> {
  const db = await openFolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readonly');
    const store = tx.objectStore(PDF_STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredPdfRecord | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Erro ao carregar PDF do armazenamento local.'));
    };
  });
}

export async function deletePdfBinary(id: string): Promise<void> {
  const db = await openFolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    const store = tx.objectStore(PDF_STORE);
    const req = store.delete(id);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Erro ao remover PDF do armazenamento local.'));
    };
  });
}
