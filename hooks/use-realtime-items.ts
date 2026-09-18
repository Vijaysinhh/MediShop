'use client';

import { useEffect, useState, useRef } from 'react';

interface RealtimeOptions {
  tableName: string;
  onInsert?: (data: any) => void;
  onUpdate?: (data: any) => void;
  onDelete?: (data: any) => void;
}

/**
 * Hook for real-time data synchronization (local-only mode)
 */
export function useRealtimeSubscription(options: RealtimeOptions) {
  const subscriptionRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('[Local] No realtime sync available for', options.tableName);
    setIsConnected(false);

    return () => {
      // Cleanup nothing
    };
  }, [options.tableName]);

  return {
    isConnected,
  };
}