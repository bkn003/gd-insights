import { toast } from "sonner";

export interface OfflineEntry {
    id: string;
    created_at: string;
    shop_id: string;
    category_id: string;
    size_id: string;
    customer_type_id: string | null;
    employee_id: string;
    employee_name: string;
    notes: string;
    voice_note_blob?: Blob;
    image_blobs: Blob[];
    status: 'pending' | 'syncing' | 'error';
    retry_count: number;
    error_message?: string;
}

const DB_NAME = 'GDInsightsDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_entries';

class OfflineStore {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event);
                reject('Failed to open database');
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('created_at', 'created_at', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
            };
        });
    }

    async saveEntry(entry: OfflineEntry): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('Database not initialized');

            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onsuccess = () => {
                toast.info('Saved offline. Will sync when online.');
                resolve();
            };

            request.onerror = () => {
                toast.error('Failed to save offline data.');
                reject(request.error);
            };
        });
    }

    async getPendingEntries(): Promise<OfflineEntry[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('Database not initialized');

            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('status');
            // get all with 'pending' or 'error' status? 
            // Simplified: just get all and filter in memory or use cursor if needed
            // For now, let's just get all and filtering is easier unless large dataset
            const request = store.getAll();

            request.onsuccess = () => {
                resolve((request.result as OfflineEntry[]).filter(e => e.status !== 'syncing')); // Don't pick up currently syncing ones if any
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getAllEntries(): Promise<OfflineEntry[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('Database not initialized');
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result as OfflineEntry[]);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteEntry(id: string): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('Database not initialized');
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async updateEntryStatus(id: string, status: OfflineEntry['status'], errorMessage?: string): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('Database not initialized');

            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const data = getRequest.result as OfflineEntry;
                if (data) {
                    data.status = status;
                    if (errorMessage) data.error_message = errorMessage;
                    if (status === 'error') data.retry_count = (data.retry_count || 0) + 1;

                    store.put(data).onsuccess = () => resolve();
                } else {
                    resolve(); // Entry not found
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async clearAll(): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('Database not initialized');
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.clear().onsuccess = () => resolve();
        });
    }
}

export const offlineStore = new OfflineStore();
