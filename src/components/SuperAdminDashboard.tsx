import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const admins = useMemo(() => allProfiles.filter(p => p.role === 'admin'), [allProfiles]);

  const filteredAdmins = useMemo(() => admins.filter(a =>
    !searchQuery ||
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  ), [admins, searchQuery]);

  const getSubUsers = (adminId: string) =>
    allProfiles.filter(p => p.admin_id === adminId && p.id !== adminId);

  const getAdminStats = (adminId: string) => {
    const shopCount = allShops.filter((s: any) => s.admin_id === adminId).length;
    const userCount = allProfiles.filter((p: any) => p.admin_id === adminId && p.id !== adminId).length;
    return { shopCount, userCount };
  };

  const toggleExpand = (adminId: string) => {
    setExpandedAdmins(prev => {
      const next = new Set(prev);
      if (next.has(adminId)) next.delete(adminId);
      else next.add(adminId);
      return next;
    });
  };

  const handleRoleChange = async (profile: AdminProfile, newRole: string) => {
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
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to change role');
    }
  };

  const handleActivate = async (admin: AdminProfile) => {
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
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate');
    }
  };

  const handlePause = async (admin: AdminProfile) => {
    try {
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('id', admin.id);
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('admin_id', admin.id);
      toast.success(`${admin.name} and all sub-users paused.`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause');
    }
  };

  const handleDelete = async () => {
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
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete admin');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetLimits = async () => {
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
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update limits');
    }
  };

  const openLimitsDialog = (admin: AdminProfile) => {
    setSelectedAdmin(admin);
    setMaxShops(admin.max_shops || 5);
    setMaxUsers(admin.max_users || 10);
    setMaxEntries(admin.max_entries ?? '');
    setMaxImagesPerEntry(admin.max_images_per_entry ?? 10);
    setLimitsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading admin management...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tenant Admin Cards with nested sub-users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tenant Admin Management
          </CardTitle>
          <CardDescription>
            {admins.length} registered admin(s). Click an admin row to see their sub-users.
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map(admin => {
                  const stats = getAdminStats(admin.id);
                  const subUsers = getSubUsers(admin.id);
                  const isExpanded = expandedAdmins.has(admin.id);
                  const entryCount = entryCounts[admin.id] || 0;

                  return (
                    <>
                      <TableRow key={admin.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(admin.id)}>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {admin.status === 'paused' ? (
                              <Button size="sm" variant="outline" onClick={() => handleActivate(admin)} title="Activate">
                                <Play className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handlePause(admin)} title="Pause">
                                <Pause className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openLimitsDialog(admin)} title="Set limits">
                              <Settings className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeleteAdmin(admin)} title="Delete">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Sub-users nested under admin */}
                      {isExpanded && subUsers.map(sub => (
                        <TableRow key={sub.id} className="bg-muted/20">
                          <TableCell></TableCell>
                          <TableCell className="pl-8 text-sm">
                            ↳ {sub.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sub.email || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={sub.status === 'active' ? 'default' : 'destructive'} className="text-xs">{sub.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(sub.created_at), 'PP')}</TableCell>
                          <TableCell className="text-sm">
                            {sub.last_login_at ? format(new Date(sub.last_login_at), 'PP p') : 'Never'}
                          </TableCell>
                          <TableCell colSpan={2}>
                            <Badge variant="outline" className="text-xs">{sub.role}</Badge>
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            {sub.id !== user?.id && (
                              <Select
                                value={sub.role}
                                onValueChange={(val) => handleRoleChange(sub, val)}
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
                          <TableCell colSpan={9} className="text-sm text-muted-foreground italic">
                            No sub-users for this admin
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                {filteredAdmins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No admins found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Super Admins only section */}
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
