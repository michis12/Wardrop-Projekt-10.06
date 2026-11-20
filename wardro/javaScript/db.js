// db.js — lokaler Speicher auf dem Gerät (IndexedDB), kein Server nötig.
// items:   { id, category, blob, created }
// outfits: { id, blob, created, parts: {head, torso, legs, shoes}, accessories: [ids] }

const LocalDB = (() => {
    const DB_NAME = 'wardro';
    const DB_VERSION = 1;
    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('items')) {
                    db.createObjectStore('items', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('outfits')) {
                    db.createObjectStore('outfits', { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        // Browser bitten, die Daten nicht automatisch zu löschen
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
        }
        return dbPromise;
    }

    async function run(store, mode, fn) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, mode);
            const req = fn(tx.objectStore(store));
            tx.oncomplete = () => resolve(req ? req.result : undefined);
            tx.onerror = () => reject(tx.error);
        });
    }

    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    return {
        newId,
        getAll: (store) => run(store, 'readonly', s => s.getAll()),
        put:    (store, obj) => run(store, 'readwrite', s => s.put(obj)),
        remove: (store, id) => run(store, 'readwrite', s => s.delete(id)),
    };
})();
