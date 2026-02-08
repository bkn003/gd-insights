import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Play, Pause, Trash2, Settings, Users, Building, Shield } from 'lucide-react';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { format } from 'date-fns';

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
}

export const SuperAdminDashboard = () => {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [allShops, setAllShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null);
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [maxShops, setMaxShops] = useState(5);
  const [maxUsers, setMaxUsers] = useState(10);

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

      const profiles = profilesRes.data || [];
      const shops = shopsRes.data || [];

      setAllProfiles(profiles);
      setAllShops(shops);
      setAdmins(profiles.filter((p: any) => p.role === 'admin') as AdminProfile[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const getAdminStats = (adminId: string) => {
    const shopCount = allShops.filter((s: any) => s.admin_id === adminId).length;
    const userCount = allProfiles.filter((p: any) => p.admin_id === adminId && p.id !== adminId).length;
    return { shopCount, userCount };
  };

  const handleActivate = async (admin: AdminProfile) => {
    try {
      const { error } = await (supabase
        .from('profiles') as any)
        .update({ status: 'active' })
        .eq('id', admin.id);
      if (error) throw error;

      // Also activate sub-users
      await (supabase
        .from('profiles') as any)
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
      // Pause admin
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('id', admin.id);
      // Pause all sub-users (triggers realtime → force logout)
      await (supabase.from('profiles') as any).update({ status: 'paused' }).eq('admin_id', admin.id);

      toast.success(`${admin.name} and all sub-users paused`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause');
    }
  };

  const handleDelete = async () => {
    if (!deleteAdmin) return;
    setIsDeleting(true);
    try {
      // Soft-delete admin and all sub-users (triggers force logout via realtime)
      await (supabase
        .from('profiles') as any)
        .update({ deleted_at: new Date().toISOString(), status: 'paused' })
        .eq('admin_id', deleteAdmin.id);

      toast.success(`${deleteAdmin.name} and all associated data deleted`);
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
      const { error } = await (supabase
        .from('profiles') as any)
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
            Admin Management
          </CardTitle>
          <CardDescription>
            {admins.length} registered admin(s). Manage tenant admins, set limits, and control access.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                {admins.map(admin => {
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
                {admins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No admins registered yet. New admins will appear here after they sign up.
                    </TableCell>
                  </TableRow>
                )}
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
        title="Delete Admin"
        itemName={deleteAdmin?.name}
        description={`Are you sure you want to delete "${deleteAdmin?.name}"? This will delete the admin and ALL their data including shops, sub-users, and entries. All active sessions will be terminated immediately.`}
        loading={isDeleting}
      />
    </div>
  );
};
