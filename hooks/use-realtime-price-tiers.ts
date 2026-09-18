'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import type { PriceTier } from '@/lib/db';

export function useRealtimePriceTiers(itemId: number | null) {
  const { user } = useAuth();
  const supabase = createClient();
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);

  const mapPriceTierRow = useCallback((row: any): PriceTier => {
    const createdAt = row?.created_at
      ? new Date(row.created_at).getTime()
      : typeof row?.createdAt === 'number'
        ? row.createdAt
        : Date.now();

    const updatedAt = row?.updated_at
      ? new Date(row.updated_at).getTime()
      : typeof row?.updatedAt === 'number'
        ? row.updatedAt
        : createdAt;

    return {
      id: row?.id != null ? Number(row.id) : undefined,
      itemId: row?.item_id != null ? Number(row.item_id) : Number(row?.itemId || 0),
      quantity: row?.quantity != null ? Number(row.quantity) : 0,
      unitId: row?.unit_id != null ? Number(row.unit_id) : Number(row?.unitId || 0),
      price: row?.price != null ? Number(row.price) : 0,
      createdAt,
      updatedAt,
    };
  }, []);

  // Fetch initial price tiers
  const fetchPriceTiers = useCallback(async () => {
    if (!user || !itemId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('price_tiers')
        .select('*')
        .eq('item_id', itemId)
        .order('quantity', { ascending: true });

      if (error) throw error;
      setPriceTiers((data || []).map(mapPriceTierRow));
    } catch (err) {
      console.error('[v0] Error fetching price tiers:', err);
      setPriceTiers([]);
    } finally {
      setLoading(false);
    }
  }, [user, itemId, supabase, mapPriceTierRow]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !itemId) return;

    fetchPriceTiers();

    // Subscribe to price_tiers changes for this item
    const subscription = supabase
      .channel(`price_tiers:item_id=eq.${itemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_tiers',
          filter: `item_id=eq.${itemId}`,
        },
        (payload) => {
          console.log('[v0] Price tier change received:', payload);
          setIsConnected(true);

          if (payload.eventType === 'INSERT') {
            setPriceTiers((prev) => [...prev, mapPriceTierRow(payload.new)]);
          } else if (payload.eventType === 'UPDATE') {
            setPriceTiers((prev) => {
              const next = mapPriceTierRow(payload.new);
              return prev.map((tier) => (tier.id === next.id ? next : tier));
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload?.old?.id != null ? Number(payload.old.id) : null;
            if (deletedId == null) return;
            setPriceTiers((prev) => prev.filter((tier) => tier.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log('[v0] Price tier subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    subscriptionRef.current = subscription;

    return () => {
      subscription.unsubscribe();
    };
  }, [user, itemId, fetchPriceTiers, supabase, mapPriceTierRow]);

  return {
    priceTiers,
    loading,
    isConnected,
    refetch: fetchPriceTiers,
  };
}
