import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Play, Pause, Trash2, Settings, Users, Building, Shield, Search, ChevronDown, ChevronRight, Image } from 'lucide-react';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface AdminProfile {
  id: string;
  name: string;
  email: string | null;
  status: string;
  max_shops: number;
  max_users: number;
  max_entries: number | null;
  max_images_per_entry: number | null;
  created_at: string;
  last_login_at: string | null;
  admin_id: string | null;
  role: string;
  shop_id: string | null;
}

export const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<AdminProfile[]>([]);
  const [allShops, setAllShops] = useState<any[]>([]);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null);
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [maxShops, setMaxShops] = useState(5);
  const [maxUsers, setMaxUsers] = useState(10);
  const [maxEntries, setMaxEntries] = useState<number | ''>('');
  const [maxImagesPerEntry, setMaxImagesPerEntry] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profilesRes, shopsRes] = await Promise.all([
        supabase.from('profiles').select('*').is('deleted_at', null),
        supabase.from('shops').select('*').is('deleted_at', null),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (shopsRes.error) throw shopsRes.error;

      const profiles = (profilesRes.data || []) as AdminProfile[];
      setAllProfiles(profiles);
      setAllShops(shopsRes.data || []);

      // Fetch entry counts per admin
      const adminIds = profiles.filter(p => p.role === 'admin').map(p => p.id);
      if (adminIds.length > 0) {
        const { data: entries } = await supabase
          .from('goods_damaged_entries')
          .select('admin_id');
        
        if (entries) {
          const counts: Record<string, number> = {};
          entries.forEach((e: any) => {
            if (e.admin_id) counts[e.admin_id] = (counts[e.admin_id] || 0) + 1;
          });
          setEntryCounts(counts);
        }

        // Fetch image counts per admin (via entries -> images)
        const { data: images } = await supabase
          .from('gd_entry_images')
          .select('gd_entry_id');

        if (images && entries) {
          const entryAdminMap: Record<string, string> = {};
          entries.forEach((e: any) => { if (e.admin_id) entryAdminMap[e.admin_id] = e.admin_id; });
          
          // Build entry-to-admin mapping
          const { data: entryDetails } = await supabase
            .from('goods_damaged_entries')
            .select('id, admin_id');
          
          if (entryDetails) {
            const entryToAdmin: Record<string, string> = {};
            entryDetails.forEach((e: any) => { if (e.admin_id) entryToAdmin[e.id] = e.admin_id; });
            
            const imgCounts: Record<string, number> = {};
            images.forEach((img: any) => {
              const adminId = entryToAdmin[img.gd_entry_id];
              if (adminId) imgCounts[adminId] = (imgCounts[adminId] || 0) + 1;
            });
            setImageCounts(imgCounts);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for instant updates
  useEffect(() => {
    const profileChannel = supabase
      .channel('sa-profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goods_damaged_entries' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [fetchData]);

  const admins = useMemo(() => allProfiles.filter(p => p.role === 'admin'), [allProfiles]);

  const filteredAdmins = useMemo(() => admins.filter(a =>
    !searchQuery ||
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  ), [admins, searchQuery]);

  const getSubUsers = useCallback((adminId: string) =>
    allProfiles.filter(p => p.admin_id === adminId && p.id !== adminId),
  [allProfiles]);

  const getAdminStats = useCallback((adminId: string) => {
    const shopCount = allShops.filter((s: any) => s.admin_id === adminId).length;
    const userCount = allProfiles.filter((p: any) => p.admin_id === adminId && p.id !== adminId).length;
    return { shopCount, userCount };
  }, [allShops, allProfiles]);

  const toggleExpand = useCallback((adminId: string) => {
    setExpandedAdmins(prev => {
      const next = new Set(prev);
      if (next.has(adminId)) next.delete(adminId);
      else next.add(adminId);
      return next;
    });
  }, []);

  const handleRoleChange = useCallback(async (profile: AdminProfile, newRole: string) => {
    if (profile.id === user?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    try {
      const updateData: any = { role: newRole };
      if (newRole === 'admin') {
        updateData.admin_id = profile.id;
        updateData.status = 'paused';
      }
      if (newRole === 'super_admin') {
        updateData.admin_id = null;
        updateData.status = 'active';
      }
      if (newRole === 'manager' || newRole === 'user') {
        if (!profile.admin_id || profile.admin_id === profile.id) {
          toast.error("Cannot demote to sub-user role without an admin parent.");
          return;
        }
      }

      const { error } = await (supabase.from('profiles') as any)
        .update(updateData)
        .eq('id', profile.id);
      if (error) throw error;

      toast.success(`${profile.name}'s role changed to ${newRole}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to change role');
    }
  }, [user?.id]);

  const handleActivate = useCallback(async (admin: AdminProfile) => {
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ status: 'active' })
        .eq('id', admin.id);
      if (error) throw error;

      await (supabase.from('profiles') as any)
        .update({ status: 'active' })
        .eq('admin_id', admin.id)
        .neq('id', admin.id);

      toast.success(`${admin.name} activated successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate');
    }
  }, []);

  const handlePause = useCallback(async (admin: AdminProfile) => {
    try {
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('id', admin.id);
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('admin_id', admin.id);
      
      // Force logout the admin and all sub-users via edge function
      try {
        await supabase.functions.invoke('update-sub-user', {
          body: { user_id: admin.id, action: 'pause' },
        });
        const subUsers = getSubUsers(admin.id);
        for (const sub of subUsers) {
          await supabase.functions.invoke('update-sub-user', {
            body: { user_id: sub.id, action: 'pause' },
          });
        }
      } catch (e) {
        console.warn('Force logout via edge function failed:', e);
      }
      
      toast.success(`${admin.name} and all sub-users paused & logged out.`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause');
    }
  }, [getSubUsers]);

  const handleDelete = useCallback(async () => {
    if (!deleteAdmin) return;
    setIsDeleting(true);
    try {
      const adminId = deleteAdmin.id;
      await (supabase.from('goods_damaged_entries') as any).delete().eq('admin_id', adminId);
      await (supabase.from('shops') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId);
      await Promise.all([
        (supabase.from('categories') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('sizes') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('customer_types') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('custom_fields') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
      ]);
      await (supabase.from('profiles') as any)
        .update({ deleted_at: new Date().toISOString(), status: 'paused' })
        .eq('admin_id', adminId).neq('id', adminId);
      await (supabase.from('profiles') as any)
        .update({ deleted_at: new Date().toISOString(), status: 'paused' })
        .eq('id', adminId);
      await (supabase.from('app_settings') as any).delete().eq('admin_id', adminId);

      toast.success(`${deleteAdmin.name} and ALL associated data deleted.`);
      setDeleteAdmin(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete admin');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteAdmin]);

  const handleSetLimits = useCallback(async () => {
    if (!selectedAdmin) return;
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          max_shops: maxShops,
          max_users: maxUsers,
          max_entries: maxEntries === '' ? null : maxEntries,
          max_images_per_entry: maxImagesPerEntry,
        })
        .eq('id', selectedAdmin.id);
      if (error) throw error;

      toast.success('Limits updated successfully');
      setLimitsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update limits');
    }
  }, [selectedAdmin, maxShops, maxUsers, maxEntries, maxImagesPerEntry]);

  const openLimitsDialog = useCallback((admin: AdminProfile) => {
    setSelectedAdmin(admin);
    setMaxShops(admin.max_shops || 5);
    setMaxUsers(admin.max_users || 10);
    setMaxEntries(admin.max_entries ?? '');
    setMaxImagesPerEntry(admin.max_images_per_entry ?? 10);
    setLimitsDialogOpen(true);
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading admin management...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{admins.length}</div>
            <div className="text-sm text-muted-foreground">Total Admins</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{allProfiles.filter(p => p.role !== 'admin' && p.role !== 'super_admin').length}</div>
            <div className="text-sm text-muted-foreground">Total Sub-Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{allShops.length}</div>
            <div className="text-sm text-muted-foreground">Total Shops</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{Object.values(entryCounts).reduce((a, b) => a + b, 0)}</div>
            <div className="text-sm text-muted-foreground">Total Entries</div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Admin Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tenant Admin Management
          </CardTitle>
          <CardDescription>
            {admins.length} registered admin(s). Click to expand and see sub-users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signup</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Shops</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map(admin => {
                  const stats = getAdminStats(admin.id);
                  const subUsers = getSubUsers(admin.id);
                  const isExpanded = expandedAdmins.has(admin.id);
                  const entryCount = entryCounts[admin.id] || 0;
                  const imageCount = imageCounts[admin.id] || 0;

                  return (
                    <AdminRow
                      key={admin.id}
                      admin={admin}
                      stats={stats}
                      subUsers={subUsers}
                      isExpanded={isExpanded}
                      entryCount={entryCount}
                      imageCount={imageCount}
                      currentUserId={user?.id}
                      onToggleExpand={toggleExpand}
                      onActivate={handleActivate}
                      onPause={handlePause}
                      onDelete={setDeleteAdmin}
                      onLimits={openLimitsDialog}
                      onRoleChange={handleRoleChange}
                    />
                  );
                })}
                {filteredAdmins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No admins found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Super Admins section */}
      {allProfiles.filter(p => p.role === 'super_admin').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Super Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allProfiles.filter(p => p.role === 'super_admin').map(sa => (
                <div key={sa.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{sa.name}</span>
                    {sa.id === user?.id && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                    <p className="text-sm text-muted-foreground">{sa.email || '-'}</p>
                  </div>
                  <Badge variant="secondary">super_admin</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limits Dialog */}
      <Dialog open={limitsDialogOpen} onOpenChange={setLimitsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Limits for {selectedAdmin?.name}</DialogTitle>
            <DialogDescription>
              Configure resource limits for this admin tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Maximum Shops</Label>
              <Input type="number" min={1} value={maxShops} onChange={e => setMaxShops(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Maximum Sub-Users</Label>
              <Input type="number" min={1} value={maxUsers} onChange={e => setMaxUsers(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Maximum GD Entries <span className="text-xs text-muted-foreground">(blank = unlimited)</span></Label>
              <Input
                type="number"
                min={0}
                value={maxEntries}
                onChange={e => setMaxEntries(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Unlimited"
              />
              <p className="text-xs text-muted-foreground">
                Current usage: {entryCounts[selectedAdmin?.id || ''] || 0} entries
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Max Images Per Entry
              </Label>
              <Input type="number" min={0} max={20} value={maxImagesPerEntry} onChange={e => setMaxImagesPerEntry(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">
                Total images stored: {imageCounts[selectedAdmin?.id || ''] || 0}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLimitsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSetLimits}>Save Limits</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteAdmin}
        onOpenChange={open => !open && setDeleteAdmin(null)}
        onConfirm={handleDelete}
        title="Delete Admin & All Data"
        itemName={deleteAdmin?.name}
        description={`Are you sure you want to delete "${deleteAdmin?.name}"? This will permanently delete the admin, ALL their sub-users, shops, categories, sizes, customer types, GD entries, and settings.`}
        loading={isDeleting}
      />
    </div>
  );
};

// Extracted admin row component for performance
interface AdminRowProps {
  admin: AdminProfile;
  stats: { shopCount: number; userCount: number };
  subUsers: AdminProfile[];
  isExpanded: boolean;
  entryCount: number;
  imageCount: number;
  currentUserId?: string;
  onToggleExpand: (id: string) => void;
  onActivate: (admin: AdminProfile) => void;
  onPause: (admin: AdminProfile) => void;
  onDelete: (admin: AdminProfile) => void;
  onLimits: (admin: AdminProfile) => void;
  onRoleChange: (profile: AdminProfile, role: string) => void;
}

const AdminRow = ({
  admin, stats, subUsers, isExpanded, entryCount, imageCount,
  currentUserId, onToggleExpand, onActivate, onPause, onDelete, onLimits, onRoleChange
}: AdminRowProps) => (
  <>
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => onToggleExpand(admin.id)}>
      <TableCell>
        {subUsers.length > 0 ? (
          isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        ) : null}
      </TableCell>
      <TableCell className="font-medium">{admin.name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{admin.email || '-'}</TableCell>
      <TableCell>
        <Badge variant={admin.status === 'active' ? 'default' : 'destructive'}>{admin.status}</Badge>
      </TableCell>
      <TableCell className="text-sm">{format(new Date(admin.created_at), 'PP')}</TableCell>
      <TableCell className="text-sm">
        {admin.last_login_at ? format(new Date(admin.last_login_at), 'PP p') : 'Never'}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1 text-sm">
          <Building className="h-3 w-3" /> {stats.shopCount}/{admin.max_shops ?? '∞'}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1 text-sm">
          <Users className="h-3 w-3" /> {stats.userCount}/{admin.max_users ?? '∞'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm">{entryCount}/{admin.max_entries ?? '∞'}</span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1 text-sm">
          <Image className="h-3 w-3" /> {imageCount}
        </span>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          {admin.status === 'paused' ? (
            <Button size="sm" variant="outline" onClick={() => onActivate(admin)} title="Activate">
              <Play className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onPause(admin)} title="Pause">
              <Pause className="h-3 w-3" />
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onLimits(admin)} title="Set limits">
            <Settings className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(admin)} title="Delete">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
    {isExpanded && subUsers.map(sub => (
      <TableRow key={sub.id} className="bg-muted/20">
        <TableCell></TableCell>
        <TableCell className="pl-8 text-sm">↳ {sub.name}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{sub.email || '-'}</TableCell>
        <TableCell>
          <Badge variant={sub.status === 'active' ? 'default' : 'destructive'} className="text-xs">{sub.status}</Badge>
        </TableCell>
        <TableCell className="text-sm">{format(new Date(sub.created_at), 'PP')}</TableCell>
        <TableCell className="text-sm">
          {sub.last_login_at ? format(new Date(sub.last_login_at), 'PP p') : 'Never'}
        </TableCell>
        <TableCell colSpan={3}>
          <Badge variant="outline" className="text-xs">{sub.role}</Badge>
        </TableCell>
        <TableCell></TableCell>
        <TableCell>
          {sub.id !== currentUserId && (
            <Select
              value={sub.role}
              onValueChange={(val) => onRoleChange(sub, val)}
            >
              <SelectTrigger className="w-[110px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="user">Staff</SelectItem>
              </SelectContent>
            </Select>
          )}
        </TableCell>
      </TableRow>
    ))}
    {isExpanded && subUsers.length === 0 && (
      <TableRow className="bg-muted/20">
        <TableCell></TableCell>
        <TableCell colSpan={10} className="text-sm text-muted-foreground italic">
          No sub-users for this admin
        </TableCell>
      </TableRow>
    )}
  </>
);
