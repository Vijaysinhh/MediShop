'use client';

export function useSyncToCloud() {
  const syncItemToCloud = async (item: any) => {
    console.log('[Local] Item saved locally only:', item?.id);
    return item;
  };

  const syncSaleToCloud = async (sale: any) => {
    console.log('[Local] Sale saved locally only:', sale?.id);
    return sale;
  };

  const loadItemsFromCloud = async () => {
    return [];
  };

  const loadSalesFromCloud = async () => {
    return [];
  };

  const refreshCloudData = async () => {
    console.log('[Local] No cloud sync available');
  };

  return {
    syncItemToCloud,
    syncSaleToCloud,
    loadItemsFromCloud,
    loadSalesFromCloud,
    refreshCloudData,
  };
}