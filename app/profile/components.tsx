'use client';

import { useLanguage } from '@/providers/language-provider';
import { useAuth } from '@/providers/auth-provider';
import { PageContainer } from '@/components/page-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from '@/components/ui/avatar';
import { 
  User, 
  Building, 
  Users, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  HeartPulse,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export function Profile() {
  const { t, language } = useLanguage();
  const { user, currentShopId, currentShop } = useAuth();
  const supabase = createClient();
  const { toast } = useToast();

  const [staffCount, setStaffCount] = useState(0);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentShopId) {
      loadData();
    }
  }, [currentShopId]);

  const loadData = async () => {
    if (!currentShopId) return;
    setLoading(true);

    try {
      // Load staff count
      const { data: workers } = await (supabase as any)
        .from('users')
        .select('*')
        .eq('shop_id', currentShopId)
        .eq('role', 'worker');
      
      setStaffCount(workers?.length || 0);

      // Load subscriptions
      const { data: subs } = await (supabase as any)
        .from('subscriptions')
        .select('*')
        .eq('shop_id', currentShopId)
        .order('created_at', { ascending: false });

      setSubscriptions(subs || []);
    } catch (e) {
      console.error('Failed to load profile data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Calculate subscription status
  const getSubscriptionStatus = () => {
    if (!currentShop) return { label: 'Unknown', status: 'unknown' };
    const endDate = currentShop.subscriptionEndDate ? new Date(currentShop.subscriptionEndDate) : null;
    const now = new Date();

    if (!endDate) {
      return { label: 'Not Subscribed', status: 'inactive' };
    }

    if (currentShop.isPaused) {
      return { label: 'Paused', status: 'paused' };
    }

    const isExpired = endDate < now;
    const isExpiringSoon = !isExpired && (endDate.getTime() - now.getTime()) < 2 * 24 * 60 * 60 * 1000;

    if (isExpired) {
      return { label: 'Expired', status: 'expired' };
    }

    if (isExpiringSoon) {
      return { label: 'Expiring Soon', status: 'expiring-soon' };
    }

    return { label: 'Active', status: 'active' };
  };

  // Helper to format date (handles both timestamp and string)
  const formatDate = (date: number | string | null | undefined) => {
    if (!date) return null;
    return new Date(typeof date === 'number' ? date : date).toLocaleDateString(('en-IN'));
  };

  const subStatus = getSubscriptionStatus();

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    'expiring-soon': 'bg-orange-100 text-orange-800',
    expired: 'bg-red-100 text-red-800',
    paused: 'bg-gray-100 text-gray-800',
    inactive: 'bg-gray-100 text-gray-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const statusIcons = {
    active: CheckCircle2,
    'expiring-soon': AlertCircle,
    expired: AlertCircle,
    paused: Clock,
    inactive: Clock,
    unknown: Clock,
  };

  const StatusIcon = statusIcons[subStatus.status as keyof typeof statusIcons];

  return (
    <PageContainer>
      <section className="relative overflow-hidden rounded-[2rem] border border-teal-800/10 bg-gradient-to-br from-teal-700 to-emerald-600 p-5 text-white shadow-[0_18px_45px_rgba(15,118,110,0.18)] sm:p-7">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">
              <HeartPulse className="h-4 w-4" />
              MediShop account
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
            <p className="mt-1 text-sm leading-6 text-teal-100">Your account, pharmacy, team, and subscription details.</p>
          </div>
          <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/15 sm:flex">
            <User className="h-6 w-6" />
          </span>
        </div>
      </section>

      <div className="grid gap-6">
        {/* User Info Card */}
        <Card className="overflow-hidden border-teal-100 shadow-sm">
          <CardHeader className="border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white">
            <CardTitle className="flex items-center gap-3 text-lg">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" alt={user?.username} />
                <AvatarFallback className="bg-teal-700 text-white text-2xl">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Username</p>
                    <p className="text-lg font-semibold">{user?.username}</p>
                  </div>
                  {currentShop?.phoneNumber && (
                    <div>
                      <p className="text-sm text-muted-foreground">Phone Number</p>
                      <p className="font-medium">{currentShop.phoneNumber}</p>
                    </div>
                  )}
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{user?.role}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shop Info Card */}
        {currentShop && (
          <Card className="overflow-hidden border-teal-100 shadow-sm">
            <CardHeader className="border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white">
              <CardTitle className="flex items-center gap-3 text-lg">
                <Building className="h-5 w-5" />
                Pharmacy Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Pharmacy Name</p>
                <p className="text-lg font-semibold">{currentShop.shopName}</p>
              </div>
              {currentShop.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{currentShop.address}</p>
                </div>
              )}
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Staff Count</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-700" />
                    <p className="text-lg font-semibold">{staffCount}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription Status Card */}
        {currentShop && (
          <Card className="overflow-hidden border-teal-100 shadow-sm">
            <CardHeader className="border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white">
              <CardTitle className="flex items-center gap-3 text-lg">
                <CreditCard className="h-5 w-5" />
                Subscription Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${statusColors[subStatus.status as keyof typeof statusColors]}`}>
                  <StatusIcon className="h-4 w-4" />
                  {subStatus.label}
                </div>
              </div>
              {currentShop.subscriptionEndDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Ends On</p>
                  <p className="font-medium">
                    {formatDate(currentShop.subscriptionEndDate)}
                  </p>
                </div>
              )}
              {currentShop.lastPaymentDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Payment Date</p>
                  <p className="font-medium">
                    {formatDate(currentShop.lastPaymentDate)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment History Card */}
        {subscriptions.length > 0 && (
          <Card className="overflow-hidden border-teal-100 shadow-sm">
            <CardHeader className="border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white">
              <CardTitle className="flex items-center gap-3 text-lg">
                <CreditCard className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                    <div className="space-y-1">
                      <p className="font-medium">₹{sub.amount}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(sub.start_date)} - {formatDate(sub.end_date)}
                      </p>
                      {sub.transaction_id && (
                        <p className="text-xs text-muted-foreground">Transaction ID: {sub.transaction_id}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        sub.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : sub.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sub.status}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">{sub.payment_method}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-teal-700" />
            <p className="text-muted-foreground">Loading profile data…</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
