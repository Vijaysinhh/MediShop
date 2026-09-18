'use client';

import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { subscribeToPushNotifications } from '@/lib/push-notifications';
import { useAuth } from '@/providers/auth-provider';

interface PushNotificationToggleProps {
  compact?: boolean;
}

export function PushNotificationToggle({ compact = false }: PushNotificationToggleProps) {
  const { currentShopId, user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  // Legacy push tables use numeric Dukan IDs; they are disabled until moved to MediShop UUID records.
  if (typeof currentShopId !== 'number' || permission === 'granted' || permission === 'unsupported') {
    return null;
  }

  const enableNotifications = async () => {
    setIsEnabling(true);
    try {
      await subscribeToPushNotifications({ shopId: currentShopId, userId: undefined });
      setPermission('granted');
      toast.success('Background notifications enabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to enable notifications');
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? 'icon' : 'sm'}
      onClick={() => void enableNotifications()}
      disabled={isEnabling || permission === 'denied'}
      className={compact ? 'h-7 w-7' : 'gap-2'}
      title={permission === 'denied' ? 'Notifications are blocked in browser settings' : 'Enable background notifications'}
    >
      {isEnabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      {!compact && <span>{permission === 'denied' ? 'Alerts blocked' : 'Enable alerts'}</span>}
    </Button>
  );
}
