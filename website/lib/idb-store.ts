const DB_NAME = 'bitcoin-mint';
const DB_VERSION = 1;

const STORES = {
  stampReceipts: 'stamp-receipts',
  mintDocuments: 'mint-documents',
  walletKeys: 'wallet-keys',
} as const;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.stampReceipts)) {
        db.createObjectStore(STORES.stampReceipts, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.mintDocuments)) {
        const store = db.createObjectStore(STORES.mintDocuments, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(STORES.walletKeys)) {
        db.createObjectStore(STORES.walletKeys, { keyPath: 'type' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const objectStore = transaction.objectStore(store);
    const req = fn(objectStore);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    const objectStore = transaction.objectStore(store);
    const req = objectStore.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const stampReceipts = {
  save: (receipt: Record<string, unknown>) => tx(STORES.stampReceipts, 'readwrite', (s) => s.put(receipt)),
  get: (id: string) => tx<Record<string, unknown> | undefined>(STORES.stampReceipts, 'readonly', (s) => s.get(id)),
  list: () => getAll<Record<string, unknown>>(STORES.stampReceipts),
  update: async (id: string, patch: Record<string, unknown>) => {
    const db = await open();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORES.stampReceipts, 'readwrite');
      const store = transaction.objectStore(STORES.stampReceipts);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) { reject(new Error('Not found')); return; }
        store.put({ ...getReq.result, ...patch });
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },
};

export const mintDocuments = {
  save: (doc: { id: string; name: string; data: string; updatedAt: string }) =>
    tx(STORES.mintDocuments, 'readwrite', (s) => s.put(doc)),
  get: (id: string) => tx<{ id: string; name: string; data: string; updatedAt: string } | undefined>(STORES.mintDocuments, 'readonly', (s) => s.get(id)),
  list: () => getAll<{ id: string; name: string; data: string; updatedAt: string }>(STORES.mintDocuments),
  delete: (id: string) => tx(STORES.mintDocuments, 'readwrite', (s) => s.delete(id)),
};

export const walletKeys = {
  get: () => tx<{ type: string; encryptedKey: string; iv: string; salt: string } | undefined>(STORES.walletKeys, 'readonly', (s) => s.get('master')),
  set: (data: { type: string; encryptedKey: string; iv: string; salt: string }) =>
    tx(STORES.walletKeys, 'readwrite', (s) => s.put(data)),
  delete: () => tx(STORES.walletKeys, 'readwrite', (s) => s.delete('master')),
  has: async () => {
    const result = await tx<{ type: string } | undefined>(STORES.walletKeys, 'readonly', (s) => s.get('master'));
    return !!result;
  },
};
