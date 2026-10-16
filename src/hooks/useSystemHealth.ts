import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type HealthStatus = 'checking' | 'healthy' | 'error' | 'unknown';

export interface SystemHealth {
  supabase: HealthStatus;
  backend: HealthStatus;
  database: HealthStatus;
  lastChecked: Date | null;
}

const INITIAL_HEALTH: SystemHealth = {
  supabase: 'checking',
  backend: 'checking',
  database: 'checking',
  lastChecked: null,
};

/**
 * Shared system health check hook — extracted from AdminHealthDashboard
 * to eliminate duplicated health-check logic across components.
 *
 * Pings:
 * 1. Supabase REST (platform_settings query) → DB + REST connectivity
 * 2. Auth connectivity check → Function deployment
 */
export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth>(INITIAL_HEALTH);

  const checkHealth = useCallback(async () => {
    setHealth({ ...INITIAL_HEALTH });

    // Check 1: Supabase REST + Database connectivity
    try {
      const { error } = await supabase.from('platform_settings').select('id').limit(1);
      setHealth((prev) => ({
        ...prev,
        supabase: error ? 'error' : 'healthy',
        database: error ? 'error' : 'healthy',
      }));
    } catch {
      setHealth((prev) => ({ ...prev, supabase: 'error', database: 'error' }));
    } // Check 2: Auth connectivity check (lightweight auth check)
 try {
 const { error } = await supabase.auth.getSession();
 // If we can reach Supabase auth, backend is reachable
 setHealth((prev) => ({
 ...prev,
 backend: error ? 'error' : 'healthy',
 }));
 } catch {
 setHealth((prev) => ({ ...prev, backend: 'error' }));
 }

    setHealth((prev) => ({ ...prev, lastChecked: new Date() }));
  }, []);

  return { health, checkHealth };
}
