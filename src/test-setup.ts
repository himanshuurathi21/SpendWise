import '@testing-library/jest-dom/vitest';

// Stub localStorage for environments that don't provide it (e.g. happy-dom)
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(k => delete store[k]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });
}

// Stub IndexedDB for environments that don't provide it
// Uses queueMicrotask instead of setTimeout so Dexie init works with vi.useFakeTimers()
if (typeof indexedDB === 'undefined') {
  class FakeIDBRequest extends EventTarget {
    result: unknown = null;
    error: unknown = null;
    readyState = 'done';
    onsuccess: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    overrideonsuccess: ((e: unknown) => void) | null = null;
    constructor() {
      super();
    }
  }

  const fakeObjectStore = {
    name: 'keyval',
    keyPath: null,
    indexNames: [] as string[],
    transaction: null,
    autoIncrement: false,
    put: async () => {},
    add: async () => {},
    delete: async () => {},
    clear: async () => {},
    get: async () => undefined,
    getAll: async () => [],
    count: async () => 0,
    openCursor: async () => null,
    createIndex: () => ({}),
    index: () => ({}),
    deleteIndex: () => {},
    mutate: async () => {},
  };

  const fakeDBResult = {
    name: '',
    version: 1,
    objectStoreNames: [] as string[],
    close: () => {},
    createObjectStore: () => fakeObjectStore,
    transaction: () => ({ objectStore: () => fakeObjectStore }),
    deleteObjectStore: () => {},
  };

  class FakeIDBFactory {
    open(_name?: string) {
      const req = new FakeIDBRequest();
      const db = { ...fakeDBResult, name: _name ?? '' };
      queueMicrotask(() => {
        req.result = db;
        if (req.onsuccess) req.onsuccess({ target: req } as unknown);
      });
      return req as unknown as IDBRequest<undefined>;
    }
  }
  Object.defineProperty(globalThis, 'indexedDB', { value: new FakeIDBFactory(), writable: true });
}

// Catch unhandled rejections from Dexie/IndexedDB in test environment
process.on('unhandledRejection', reason => {
  const msg = String(reason);
  if (
    msg.includes('dexie') ||
    msg.includes('mutate') ||
    msg.includes('IndexedDB') ||
    msg.includes('Database')
  ) {
    // Swallow Dexie/IndexedDB errors in test environment - OK to ignore
  }
});
