
import { supabase } from '@/integrations/supabase/client';
import { offlineStore, OfflineEntry } from './offlineStore';
import { toast } from 'sonner';

export const syncService = {
    isSyncing: false,

    async syncPendingEntries() {
        if (this.isSyncing) return;
        if (!navigator.onLine) return;

        try {
            this.isSyncing = true;
            const pendingEntries = await offlineStore.getPendingEntries();

            if (pendingEntries.length === 0) {
                this.isSyncing = false;
                return;
            }

            toast.info(`Syncing ${pendingEntries.length} offline entries...`);

            for (const entry of pendingEntries) {
                await this.syncEntry(entry);
            }

            toast.success('Offline data synced successfully!');
        } catch (error) {
            console.error('Sync failed:', error);
            toast.error('Sync failed for some entries. Will retry later.');
        } finally {
            this.isSyncing = false;
        }
    },

    async syncEntry(entry: OfflineEntry) {
        try {
            await offlineStore.updateEntryStatus(entry.id, 'syncing');

            let voiceNoteUrl = null;

            // 1. Upload Voice Note if exists
            if (entry.voice_note_blob) {
                const fileName = `voice-note-${Date.now()}.webm`;
                const { data: voiceData, error: voiceError } = await supabase.storage
                    .from('voice_notes')
                    .upload(fileName, entry.voice_note_blob);

                if (voiceError) throw new Error(`Voice upload failed: ${voiceError.message}`);

                const { data: { publicUrl } } = supabase.storage
                    .from('voice_notes')
                    .getPublicUrl(fileName);

                voiceNoteUrl = publicUrl;
            }

            // 2. Insert Entry to Database
            const { data: insertedEntry, error: insertError } = await supabase
                .from('goods_damaged_entries')
                .insert({
                    shop_id: entry.shop_id,
                    category_id: entry.category_id,
                    size_id: entry.size_id,
                    customer_type_id: entry.customer_type_id,
                    employee_id: entry.employee_id,
                    employee_name: entry.employee_name,
                    notes: entry.notes,
                    voice_note_url: voiceNoteUrl,
                    created_at: entry.created_at // Preserve offline creation time? Or use server time? usually better to keep offline time or add 'offline_created_at' column. For now using created_at.
                })
                .select()
                .single();

            if (insertError) throw new Error(`Entry insert failed: ${insertError.message}`);

            // 3. Upload Images if exist
            if (entry.image_blobs && entry.image_blobs.length > 0 && insertedEntry) {
                for (const imageBlob of entry.image_blobs) {
                    const fileName = `gd-image-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
                    const { error: imageError } = await supabase.storage
                        .from('gd_images')
                        .upload(fileName, imageBlob);

                    if (imageError) console.error('Image upload failed:', imageError);
                    else {
                        const { data: { publicUrl } } = supabase.storage.from('gd_images').getPublicUrl(fileName);
                        // Insert into gd_entry_images table
                        await supabase.from('gd_entry_images').insert({
                            gd_entry_id: insertedEntry.id,
                            image_url: publicUrl,
                            image_name: 'Offline Image'
                        });
                    }
                }
            }

            // 4. Delete from offline store on success
            await offlineStore.deleteEntry(entry.id);

        } catch (error: any) {
            console.error(`Failed to sync entry ${entry.id}:`, error);
            await offlineStore.updateEntryStatus(entry.id, 'error', error.message || 'Unknown error');
        }
    }
};
