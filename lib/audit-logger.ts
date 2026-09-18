import { supabase } from '@/lib/supabase-sync';

type AuditAction = 'create' | 'update' | 'delete';

interface AuditLogParams {
  action: AuditAction;
  tableName: string;
  recordId?: string | number;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  userId?: number;
  shopId?: number;
}

export async function logAuditEvent(params: AuditLogParams) {
  try {
    const { action, tableName, recordId, oldData, newData, userId, shopId } = params;

    // Get client info
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'server';

    await supabase.from('audit_logs').insert({
      action,
      table_name: tableName,
      record_id: recordId?.toString(),
      old_data: oldData,
      new_data: newData,
      user_id: userId,
      shop_id: shopId,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw, just log - audit logging shouldn't break main functionality
  }
}

// Helper function to wrap operations with audit logging
export function withAuditLogging<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  params: Omit<AuditLogParams, 'oldData' | 'newData'>
) {
  return async (...args: Parameters<T>) => {
    let oldData: any = null;

    // If it's an update or delete, try to get old data first
    if (params.action === 'update' || params.action === 'delete') {
      // This would need to be customized based on the operation
      oldData = null;
    }

    const result = await operation(...args);

    await logAuditEvent({
      ...params,
      oldData,
      newData: params.action === 'delete' ? null : result,
    });

    return result;
  };
}
