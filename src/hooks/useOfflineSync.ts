
import { useState, useEffect } from 'react';
import { offlineStore } from '@/lib/offlineStore';
import { syncService } from '@/lib/syncService';

export const useOfflineSync = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncService.syncPendingEntries().then(checkPending);
        };

        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check count on mount
        checkPending();

        // Poll for pending count occasionally? or trigger on save?
        const interval = setInterval(checkPending, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    const checkPending = async () => {
        const entries = await offlineStore.getPendingEntries();
        setPendingCount(entries.length);
    };

    const manualSync = async () => {
        setIsSyncing(true);
        await syncService.syncPendingEntries();
        await checkPending();
        setIsSyncing(false);
    };

    const saveOfflineEntry = async (entryData: any, images: File[]) => {
        // Convert files to blobs
        const imageBlobs = await Promise.all(images.map(file => fetch(URL.createObjectURL(file)).then(r => r.blob())));

        // Create offline entry
        const entry: any = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            shop_id: entryData.shop_id,
            category_id: entryData.category_id,
            size_id: entryData.size_id,
            customer_type_id: entryData.customer_type_id,
            employee_id: entryData.employee_id,
            employee_name: entryData.employee_name,
            notes: entryData.notes,
            image_blobs: imageBlobs,
            status: 'pending',
            retry_count: 0
        };

        // Handle voice note from entryData? 
        // Wait, the form keeps voice note in standard file state.
        // The previous implementation in form might need adjustment or we handle it here.

        await offlineStore.saveEntry(entry);
        await checkPending();
        return true;
    };

    return {
        isOnline,
        pendingCount,
        isSyncing,
        manualSync,
        checkPending, // expose to allow components to trigger update after save
        saveOfflineEntry
    };
};
