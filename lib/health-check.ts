import { supabase } from '@/lib/supabase-sync';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type CheckType = 'database' | 'api' | 'storage' | 'auth';

export interface HealthCheckResult {
  checkType: CheckType;
  status: HealthStatus;
  responseTimeMs?: number;
  errorMessage?: string;
  details?: Record<string, any>;
  checkedAt: Date;
}

export class HealthChecker {
  static async checkDatabase(shopId?: number): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      const { error } = await supabase.from('shops').select('count', { count: 'exact', head: true });
      const latency = Date.now() - startTime;

      if (error) {
        return {
          checkType: 'database',
          status: 'unhealthy',
          errorMessage: 'Database connection failed',
          details: { error: error.message },
          checkedAt: new Date(),
        };
      }

      return {
        checkType: 'database',
        status: latency > 1000 ? 'degraded' : 'healthy',
        responseTimeMs: latency,
        errorMessage: latency > 1000 ? `High latency (${latency}ms)` : `Connected (${latency}ms)`,
        details: { latency },
        checkedAt: new Date(),
      };
    } catch (e: any) {
      return {
        checkType: 'database',
        status: 'unhealthy',
        errorMessage: 'Database check failed',
        details: { error: e?.message },
        checkedAt: new Date(),
      };
    }
  }

  static async checkAuth(shopId?: number): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      const { data } = await supabase.auth.getSession();
      const latency = Date.now() - startTime;
      
      return {
        checkType: 'auth',
        status: 'healthy',
        responseTimeMs: latency,
        errorMessage: data.session ? 'Authenticated' : 'Not authenticated',
        details: { hasSession: !!data.session },
        checkedAt: new Date(),
      };
    } catch (e: any) {
      return {
        checkType: 'auth',
        status: 'unhealthy',
        errorMessage: 'Auth check failed',
        details: { error: e?.message },
        checkedAt: new Date(),
      };
    }
  }

  static async checkStorage(shopId?: number): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.storage.listBuckets();
      const latency = Date.now() - startTime;

      if (error) {
        return {
          checkType: 'storage',
          status: 'degraded',
          responseTimeMs: latency,
          errorMessage: 'Storage access restricted',
          details: { error: error.message },
          checkedAt: new Date(),
        };
      }

      return {
        checkType: 'storage',
        status: 'healthy',
        responseTimeMs: latency,
        errorMessage: `Storage available (${data?.length || 0} buckets)`,
        details: { buckets: data?.length },
        checkedAt: new Date(),
      };
    } catch (e: any) {
      return {
        checkType: 'storage',
        status: 'degraded',
        errorMessage: 'Storage check failed',
        details: { error: e?.message },
        checkedAt: new Date(),
      };
    }
  }

  static async checkApi(shopId?: number): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      // Simple API check
      await fetch(window.location.origin);
      const latency = Date.now() - startTime;

      return {
        checkType: 'api',
        status: latency > 2000 ? 'degraded' : 'healthy',
        responseTimeMs: latency,
        checkedAt: new Date(),
      };
    } catch (e: any) {
      return {
        checkType: 'api',
        status: 'unhealthy',
        errorMessage: 'API check failed',
        details: { error: e?.message },
        checkedAt: new Date(),
      };
    }
  }

  static async runAllChecks(shopId?: number): Promise<HealthCheckResult[]> {
    const checks = [
      this.checkDatabase(shopId),
      this.checkAuth(shopId),
      this.checkStorage(shopId),
      this.checkApi(shopId),
    ];

    const results = await Promise.all(checks);

    // Save results to database
    try {
      for (const result of results) {
        await supabase.from('system_health_checks').insert({
          shop_id: shopId || 1,
          check_type: result.checkType,
          status: result.status,
          response_time_ms: result.responseTimeMs,
          error_message: result.errorMessage,
          details: result.details,
          checked_at: result.checkedAt.toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to save health checks:', e);
    }

    return results;
  }

  static getOverallStatus(checks: HealthCheckResult[]): HealthStatus {
    if (checks.some((c) => c.status === 'unhealthy')) return 'unhealthy';
    if (checks.some((c) => c.status === 'degraded')) return 'degraded';
    return 'healthy';
  }
}
