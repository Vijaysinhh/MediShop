import { supabase } from '@/lib/supabase-sync';

const TABLES_TO_BACKUP = [
  'shops',
  'categories',
  'units',
  'items',
  'price_tiers',
  'sales',
  'sale_items',
  'stock_history',
  'batches',
  'alerts',
  'credit_customers',
  'credit_entries',
  'app_settings',
  'subscriptions',
  'shop_payment_info',
];

export interface BackupData {
  version: string;
  timestamp: string;
  shopId?: string | number;
  data: Record<string, any[]>;
}

export class BackupService {
  static async createBackup(shopId?: string | number): Promise<BackupData> {
    const backup: BackupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      shopId,
      data: {},
    };

    for (const table of TABLES_TO_BACKUP) {
      try {
        let query = supabase.from(table).select('*');
        if (shopId && table !== 'shops') {
          query = query.eq('shop_id', shopId);
        }
        const { data, error } = await query;

        if (error) {
          console.error(`Failed to backup table ${table}:`, error);
          backup.data[table] = [];
        } else {
          backup.data[table] = data || [];
        }
      } catch (e) {
        console.error(`Error backing up table ${table}:`, e);
        backup.data[table] = [];
      }
    }

    return backup;
  }

  static downloadBackup(backup: BackupData) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const fileName = `backup-${new Date().toISOString().split('T')[0]}.json`;
    
    // Create download link manually without file-saver
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async restoreBackup(backupData: BackupData, shopId?: string | number) {
    const results: {
      table: string;
      success: boolean;
      inserted: number;
      error?: string;
    }[] = [];

    for (const table of TABLES_TO_BACKUP) {
      const tableData = backupData.data[table] || [];
      if (tableData.length === 0) continue;

      try {
        // Clear existing data for this shop first
        if (shopId && table !== 'shops') {
          await supabase.from(table).delete().eq('shop_id', shopId);
        }

        // Insert data in chunks to avoid payload limits
        const chunkSize = 500;
        let totalInserted = 0;

        for (let i = 0; i < tableData.length; i += chunkSize) {
          const chunk = tableData.slice(i, i + chunkSize);
          const { error } = await supabase
            .from(table)
            .insert(chunk);

          if (error) throw error;
          totalInserted += chunk.length;
        }

        results.push({
          table,
          success: true,
          inserted: totalInserted,
        });
      } catch (e: any) {
        results.push({
          table,
          success: false,
          inserted: 0,
          error: e?.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  static validateBackup(data: any): data is BackupData {
    return (
      data &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'string' &&
      typeof data.data === 'object'
    );
  }
}
