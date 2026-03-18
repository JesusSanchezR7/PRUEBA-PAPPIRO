export interface OfflineRecord<T = unknown> {
  id: string;
  value: T;
  updatedAt: string;
}

export interface PendingAction<T = unknown> {
  id?: number;
  entity: 'order';
  action: 'update-status' | 'cancel-order';
  payload: T;
  createdAt: string;
  attempts: number;
}

const DB_NAME = 'pappiro_offline_db';
const DB_VERSION = 1;
const ACTIONS_STORE = 'pending_actions';
const DATA_STORE = 'offline_data';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(ACTIONS_STORE)) {
        const actionsStore = database.createObjectStore(ACTIONS_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        actionsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(DATA_STORE)) {
        database.createObjectStore(DATA_STORE, {
          keyPath: 'id',
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'));
  });

  return dbPromise;
}

export async function enqueuePendingAction<T = unknown>(
  action: Omit<PendingAction<T>, 'id' | 'createdAt' | 'attempts'>
): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, 'readwrite');
    const store = tx.objectStore(ACTIONS_STORE);
    const request = store.add({
      ...action,
      createdAt: new Date().toISOString(),
      attempts: 0,
    } as PendingAction<T>);

    request.onsuccess = () => resolve(Number(request.result));
    request.onerror = () => reject(request.error ?? new Error('No se pudo guardar acción offline'));
  });
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, 'readonly');
    const store = tx.objectStore(ACTIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as PendingAction[]) || []);
    request.onerror = () => reject(request.error ?? new Error('No se pudieron obtener acciones offline'));
  });
}

export async function incrementPendingActionAttempts(actionId: number): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, 'readwrite');
    const store = tx.objectStore(ACTIONS_STORE);
    const getRequest = store.get(actionId);

    getRequest.onsuccess = () => {
      const current = getRequest.result as PendingAction | undefined;
      if (!current) {
        resolve();
        return;
      }

      const updateRequest = store.put({
        ...current,
        attempts: (current.attempts || 0) + 1,
      });

      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error ?? new Error('No se pudo actualizar acción offline'));
    };

    getRequest.onerror = () => reject(getRequest.error ?? new Error('No se pudo leer acción offline'));
  });
}

export async function removePendingAction(actionId: number): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, 'readwrite');
    const store = tx.objectStore(ACTIONS_STORE);
    const request = store.delete(actionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('No se pudo eliminar acción offline'));
  });
}

export async function saveOfflineData<T = unknown>(id: string, value: T): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_STORE, 'readwrite');
    const store = tx.objectStore(DATA_STORE);
    const request = store.put({
      id,
      value,
      updatedAt: new Date().toISOString(),
    } as OfflineRecord<T>);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('No se pudo guardar dato offline'));
  });
}

export async function getOfflineData<T = unknown>(id: string): Promise<T | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_STORE, 'readonly');
    const store = tx.objectStore(DATA_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const record = request.result as OfflineRecord<T> | undefined;
      resolve(record?.value ?? null);
    };

    request.onerror = () => reject(request.error ?? new Error('No se pudo leer dato offline'));
  });
}
