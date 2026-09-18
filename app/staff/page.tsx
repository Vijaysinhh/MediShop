'use client';

import { useMemo, useState } from 'react';
import { useStaff } from '@/hooks/use-staff';
import {
  useAuth,
  UserPermissions,
  DEFAULT_WORKER_PERMISSIONS,
  normalizeUserPermissions,
} from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Users, Shield, Edit2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { PageContainer, PageHeader } from '@/components/page-shell';

export default function StaffManagementPage() {
  const { user } = useAuth();
  const { staff, isLoading, addStaff, updateStaff, updateStaffPermissions, removeStaff } = useStaff();
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const { toast } = useToast();

  if (user?.role !== 'owner') {
    return (
      <PageContainer size="wide">
        <PageHeader
          title="Access Denied"
          description="Only owners can access this page."
        />
      </PageContainer>
    );
  }

  const handleAddStaff = async () => {
    if (!newUsername || !newPassword) return;
    const success = await addStaff(newUsername, newPassword);
    if (!success) {
      toast({
        title: "Error",
            description: "Could not add worker. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setNewUsername('');
    setNewPassword('');
    toast({
      title: "Success",
      description: "Worker added successfully!",
    });
  };

  const handleTogglePermission = async (userId: number, key: keyof UserPermissions, currentValue: boolean) => {
    const staffMember = staff.find(s => s.id === userId);
    if (!staffMember) return;

    const normalizedPermissions = normalizeUserPermissions('worker', staffMember.permissions);
    const newPermissions = {
      ...normalizedPermissions,
      [key]: !currentValue,
    } as UserPermissions;
    const success = await updateStaffPermissions(userId, newPermissions);
    if (!success) {
      toast({
        title: "Error",
        description: "Permission update failed. Please try again.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Success",
      description: "Permission updated!",
    });
  };

  const handleSetAllPermissions = async (userId: number, enabled: boolean) => {
    const newPermissions: UserPermissions = enabled
      ? {
          ...DEFAULT_WORKER_PERMISSIONS,
          canViewDashboard: true,
          canViewItems: true,
          canViewSales: true,
          canCreateSales: true,
          canViewUdhari: true,
        }
      : { ...DEFAULT_WORKER_PERMISSIONS };

    const success = await updateStaffPermissions(userId, newPermissions);
    if (!success) {
      toast({
        title: "Error",
        description: "Permission update failed. Please try again.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Success",
      description: enabled ? "All permissions updated!" : "Default permissions restored!",
    });
  };

  const handleRemoveStaff = async (userId: number) => {
    const success = await removeStaff(userId);
    if (!success) {
      toast({
        title: "Error",
        description: "Could not remove worker. Please try again.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Success",
      description: "Worker removed!",
    });
  };

  const handleOpenEditDialog = (staffMember: any) => {
    setEditingStaff(staffMember);
    setEditUsername(staffMember.username);
    setEditPassword('');
    setEditDialogOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    const success = await updateStaff(editingStaff.id, editUsername, editPassword);
    if (!success) {
      toast({
        title: "Error",
        description: "Could not update worker. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setEditDialogOpen(false);
    setEditingStaff(null);
    toast({
      title: "Success",
      description: "Worker updated!",
    });
  };

  const permissionOptions = useMemo(
    () => [
      { key: 'canViewDashboard', label: 'View Dashboard', desc: 'See the medical shop overview' },
      { key: 'canViewItems', label: 'View Medicines', desc: 'See medicine stock and expiry' },
      { key: 'canViewSales', label: 'View Sales', desc: 'See bills and sales history' },
      { key: 'canCreateSales', label: 'Create Sales', desc: 'Create patient bills at the counter' },
      { key: 'canViewUdhari', label: 'View Udhari', desc: 'See customer credit records' },
    ] as const,
    [],
  );

  return (
    <PageContainer size="wide" className="max-w-6xl text-stone-900">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-700 via-teal-700 to-emerald-600 p-5 text-white shadow-[0_18px_45px_rgba(15,118,110,0.18)] sm:p-7">
        <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">Team access</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Workers</h1>
            <p className="mt-1 text-sm text-teal-100">Add your pharmacy team and control what each worker can do</p>
          </div>
          <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/15 sm:flex"><Users className="h-6 w-6" /></span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">Active workers</p>
          <p className="mt-1 text-2xl font-bold text-emerald-950">{staff.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">Shop owner</p>
          <p className="mt-1 truncate text-lg font-bold text-amber-950">{user?.username || "Owner"}</p>
        </div>
      </section>

      {/* Add New Staff */}
      <Card className="mb-2 rounded-3xl border border-teal-100 bg-white shadow-[0_8px_28px_rgba(28,49,43,0.06)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Plus className="h-4 w-4" /></span>
            Add a worker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">Worker username</label>
              <Input 
                placeholder="e.g. pooja-pharmacist"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="h-11 rounded-xl border-stone-200 transition-all duration-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">Temporary password</label>
              <Input 
                type="password"
                placeholder="Enter password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11 rounded-xl border-stone-200 transition-all duration-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddStaff} className="h-11 w-full rounded-xl bg-teal-700 px-5 font-bold text-white shadow-[0_5px_14px_rgba(15,118,110,0.22)] transition-all duration-150 hover:-translate-y-px hover:bg-teal-800 hover:shadow-[0_8px_18px_rgba(15,118,110,0.28)] active:scale-[0.98] sm:w-auto">
                Add worker
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <div className="space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_700px]">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading staff...</p>
          </div>
        ) : staff.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No workers yet. Add your first pharmacy worker above.</p>
            </CardContent>
          </Card>
        ) : (
          staff.map((staffMember) => (
            <Card key={staffMember.id} className="rounded-3xl border border-stone-200/80 bg-white shadow-[0_5px_20px_rgba(28,49,43,0.05)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_12px_28px_rgba(15,118,110,0.10)]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-semibold tracking-tight">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Shield className="h-4 w-4" /></span>
                  {staffMember.username}
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="rounded-xl transition-all duration-150 hover:-translate-y-px active:scale-[0.97]"
                    onClick={() => handleOpenEditDialog(staffMember)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="rounded-xl transition-all duration-150 hover:-translate-y-px active:scale-[0.97]"
                    onClick={() => handleRemoveStaff(staffMember.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Quick Actions */}
                <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => handleSetAllPermissions(staffMember.id, true)}
                  >
                    Allow All
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => handleSetAllPermissions(staffMember.id, false)}
                  >
                    Reset to Default
                  </Button>
                </div>

                {/* Permissions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {permissionOptions.map((perm) => {
                    const currentValue = !!normalizeUserPermissions('worker', staffMember.permissions)[perm.key as keyof UserPermissions];
                    return (
                      <div key={perm.key} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-3 shadow-sm">
                        <div>
                          <p className="font-medium text-sm">{perm.label}</p>
                          <p className="text-xs text-muted-foreground">{perm.desc}</p>
                        </div>
                        <Switch
                          checked={currentValue}
                          onCheckedChange={() => handleTogglePermission(
                            staffMember.id,
                            perm.key as keyof UserPermissions,
                            currentValue
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium mb-2">Username</label>
              <Input 
                placeholder="Enter username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium mb-2">Password (leave empty to keep current)</label>
              <Input 
                type="password"
                placeholder="Enter new password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStaff} className="bg-teal-700 hover:bg-teal-800">Update worker</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
