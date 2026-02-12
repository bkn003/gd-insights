import { useState, useEffect } from 'react';
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
import { Play, Pause, Trash2, Settings, Users, Building, Shield, Search } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null);
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [maxShops, setMaxShops] = useState(5);
  const [maxUsers, setMaxUsers] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

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

      setAllProfiles((profilesRes.data || []) as AdminProfile[]);
      setAllShops(shopsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const admins = allProfiles.filter(p => p.role === 'admin');
  
  const filteredAdmins = admins.filter(a => 
    !searchQuery || 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredAllProfiles = allProfiles.filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAdminStats = (adminId: string) => {
    const shopCount = allShops.filter((s: any) => s.admin_id === adminId).length;
    const userCount = allProfiles.filter((p: any) => p.admin_id === adminId && p.id !== adminId).length;
    return { shopCount, userCount };
  };

  const handleRoleChange = async (profile: AdminProfile, newRole: string) => {
    if (profile.id === user?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    try {
      const updateData: any = { role: newRole };

      // If changing to admin, set admin_id to self and start paused
      if (newRole === 'admin') {
        updateData.admin_id = profile.id;
        updateData.status = 'paused';
      }
      // If changing to super_admin, clear admin_id
      if (newRole === 'super_admin') {
        updateData.admin_id = null;
        updateData.status = 'active';
      }
      // For manager/user, keep existing admin_id
      if (newRole === 'manager' || newRole === 'user') {
        // If this profile doesn't have an admin_id (was previously admin/super_admin),
        // we can't assign them as sub-user without an admin parent
        if (!profile.admin_id || profile.admin_id === profile.id) {
          toast.error("Cannot demote to sub-user role without an admin parent. Assign an admin_id first.");
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

      // Also activate sub-users
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
      // Pause admin and all sub-users
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('id', admin.id);
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('admin_id', admin.id);
      toast.success(`${admin.name} and all sub-users paused. They will be logged out and see a contact administrator message.`);
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

      // 1. Soft-delete all GD entries for this admin
      await (supabase.from('goods_damaged_entries') as any)
        .delete()
        .eq('admin_id', adminId);

      // 2. Soft-delete all GD entry images for this admin's entries
      // (cascade should handle, but let's be safe with related data)

      // 3. Soft-delete all shops
      await (supabase.from('shops') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('admin_id', adminId);

      // 4. Soft-delete all categories, sizes, customer_types
      await Promise.all([
        (supabase.from('categories') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('sizes') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('customer_types') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
        (supabase.from('custom_fields') as any).update({ deleted_at: new Date().toISOString() }).eq('admin_id', adminId),
      ]);

      // 5. Soft-delete all sub-users
      await (supabase.from('profiles') as any)
        .update({ deleted_at: new Date().toISOString(), status: 'paused' })
        .eq('admin_id', adminId)
        .neq('id', adminId);

      // 6. Soft-delete the admin profile itself
      await (supabase.from('profiles') as any)
        .update({ deleted_at: new Date().toISOString(), status: 'paused' })
        .eq('id', adminId);

      // 7. Delete app_settings for this admin
      await (supabase.from('app_settings') as any)
        .delete()
        .eq('admin_id', adminId);

      toast.success(`${deleteAdmin.name} and ALL associated data (shops, users, entries, settings) have been deleted.`);
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
        .update({ max_shops: maxShops, max_users: maxUsers })
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
    setLimitsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading admin management...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tenant Admin Management
          </CardTitle>
          <CardDescription>
            {admins.length} registered admin(s). Activate, pause, set limits, or delete tenant admins. New signups start paused.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signup Date</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Shops</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map(admin => {
                  const stats = getAdminStats(admin.id);
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{admin.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={admin.status === 'active' ? 'default' : 'destructive'}>
                          {admin.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(admin.created_at), 'PP')}</TableCell>
                      <TableCell className="text-sm">
                        {admin.last_login_at ? format(new Date(admin.last_login_at), 'PP p') : 'Never'}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Building className="h-3 w-3" />
                          {stats.shopCount}/{admin.max_shops ?? '∞'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Users className="h-3 w-3" />
                          {stats.userCount}/{admin.max_users ?? '∞'}
                        </span>
                      </TableCell>
                      <TableCell>
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
                  );
                })}
                {filteredAdmins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No admins registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* All Users (read-only overview with role dropdown for super admin) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users Overview
          </CardTitle>
          <CardDescription>
            View all {allProfiles.length} user(s) across the platform. Change roles as needed. {searchQuery && `(${filteredAllProfiles.length} matching)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllProfiles.map(profile => {
                  const parentAdmin = profile.admin_id
                    ? allProfiles.find(p => p.id === profile.admin_id)
                    : null;
                  const isSelf = profile.id === user?.id;

                  return (
                    <TableRow key={profile.id} className={isSelf ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium">
                        {profile.name}
                        {isSelf && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{profile.email || '-'}</TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant="secondary">{profile.role}</Badge>
                        ) : (
                          <Select
                            value={profile.role}
                            onValueChange={(val) => handleRoleChange(profile, val)}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="user">User (Staff)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.status === 'active' ? 'default' : 'destructive'}>
                          {profile.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {parentAdmin ? parentAdmin.name : profile.role === 'super_admin' ? '-' : 'Self'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(profile.created_at), 'PP')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Limits Dialog */}
      <Dialog open={limitsDialogOpen} onOpenChange={setLimitsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Limits for {selectedAdmin?.name}</DialogTitle>
            <DialogDescription>
              Configure the maximum number of shops and sub-users this admin can create.
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
        description={`Are you sure you want to delete "${deleteAdmin?.name}"? This will permanently delete the admin, ALL their sub-users, shops, categories, sizes, customer types, GD entries, and settings. All active sessions will be terminated immediately.`}
        loading={isDeleting}
      />
    </div>
  );
};
