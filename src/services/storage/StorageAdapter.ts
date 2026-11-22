import type { WorkspaceState } from '../../types/notes';

/**
 * Abstract storage adapter contract.
 * LocalStorageAdapter implements offline-first persistence today;
 * future FirebaseAuth + FirestoreAdapter can implement this exact interface.
 */
export interface StorageAdapter {
  readonly id: string;
  loadWorkspace(): Promise<WorkspaceState | null>;
  saveWorkspace(state: WorkspaceState): Promise<void>;
  clearWorkspace(): Promise<void>;
}
