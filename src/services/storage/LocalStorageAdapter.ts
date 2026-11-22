import type { WorkspaceState } from '../../types/notes';
import type { StorageAdapter } from './StorageAdapter';
import { openFolioDb, WORKSPACE_STORE } from './indexedDb';

const STORAGE_KEY = 'folionotes_workspace_v1';

function normalizeWorkspace(parsed: WorkspaceState): WorkspaceState | null {
  if (!parsed || !Array.isArray(parsed.notebooks) || !Array.isArray(parsed.sections) || !Array.isArray(parsed.pages)) {
    return null;
  }
  return {
    ...parsed,
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    notebooks: parsed.notebooks.map((nb) => ({
      ...nb,
      folderId: nb.folderId ?? null,
    })),
  };
}

async function readFromIndexedDb(): Promise<WorkspaceState | null> {
  const db = await openFolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readonly');
    const store = tx.objectStore(WORKSPACE_STORE);
    const req = store.get(STORAGE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as WorkspaceState | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function writeToIndexedDb(state: WorkspaceState): Promise<void> {
  const db = await openFolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    const store = tx.objectStore(WORKSPACE_STORE);
    const req = store.put(state, STORAGE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function deleteFromIndexedDb(): Promise<void> {
  const db = await openFolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    const store = tx.objectStore(WORKSPACE_STORE);
    const req = store.delete(STORAGE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly id = 'indexeddb-localstorage';

  async loadWorkspace(): Promise<WorkspaceState | null> {
    try {
      const fromDb = await readFromIndexedDb();
      if (fromDb) {
        return normalizeWorkspace(fromDb);
      }
    } catch {
      // Fallback to localStorage below
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const normalized = normalizeWorkspace(JSON.parse(raw) as WorkspaceState);
      if (normalized) {
        writeToIndexedDb(normalized).catch(() => undefined);
      }
      return normalized;
    } catch (error) {
      console.error('Erro ao ler dados locais:', error);
      return null;
    }
  }

  async saveWorkspace(state: WorkspaceState): Promise<void> {
    let savedToDb = false;
    try {
      await writeToIndexedDb(state);
      savedToDb = true;
    } catch (error) {
      console.error('Erro ao salvar workspace no IndexedDB:', error);
    }

    try {
      const serialized = JSON.stringify(state);
      if (serialized.length < 3_500_000 || !savedToDb) {
        window.localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch {
      // Ignore localStorage quota exceeded when IndexedDB already saved the full workspace
    }
  }

  async clearWorkspace(): Promise<void> {
    try {
      await deleteFromIndexedDb();
    } catch {
      // Ignore
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Erro ao limpar armazenamento local:', error);
    }
  }
}

export const defaultStorageAdapter: StorageAdapter = new LocalStorageAdapter();
