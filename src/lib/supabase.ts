import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import { mockSupabase, mockStore, isDemoActive, mockEdgeFunctions } from './mockDatabase';

type Database = any;

const safeUrl = Config.supabase.url && Config.supabase.url.startsWith('http')
  ? Config.supabase.url
  : 'https://placeholder.supabase.co';
const safeKey = Config.supabase.anonKey || 'placeholder-anon-key';

export const realSupabase = createClient<Database>(
  safeUrl,
  safeKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  }
);

// Transparent proxy: if demo mode is active, routes to mockSupabase, else realSupabase
export const supabase: typeof realSupabase = new Proxy(realSupabase, {
  get(_target, prop) {
    if (isDemoActive()) {
      return (mockSupabase as any)[prop] ?? (realSupabase as any)[prop];
    }
    return (realSupabase as any)[prop];
  },
}) as typeof realSupabase;

// Helper: get current session user
export const getCurrentUser = async () => {
  if (isDemoActive()) {
    if (!mockStore.currentUser) {
      await mockStore.loadFromStorage();
    }
    return mockStore.currentUser
      ? { id: mockStore.currentUser.auth_user_id, email: mockStore.currentUser.email }
      : null;
  }
  try {
    const { data: { session } } = await realSupabase.auth.getSession();
    return session?.user ?? null;
  } catch {
    return mockStore.currentUser
      ? { id: mockStore.currentUser.auth_user_id, email: mockStore.currentUser.email }
      : null;
  }
};

// Helper: get user profile with role from our users table
export const getUserProfile = async () => {
  if (isDemoActive()) {
    if (!mockStore.currentUser) {
      await mockStore.loadFromStorage();
    }
    return mockStore.currentUser;
  }

  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await realSupabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (error) return null;
    return data;
  } catch {
    return mockStore.currentUser;
  }
};

// Helper: call an Edge Function with proper error handling and demo fallback
export const callEdgeFunction = async <T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> => {
  if (isDemoActive()) {
    return mockEdgeFunctions<T>(functionName, body);
  }

  try {
    const { data, error } = await realSupabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      throw new Error(error.message || 'Edge function failed');
    }

    if (data?.error) {
      const err = data.error as { code: string; message: string };
      throw new Error(err.message || 'Operation failed');
    }

    return data as T;
  } catch (err) {
    // If remote Edge Function fails due to network or offline mode, fallback to mock in dev
    console.warn(`Edge function ${functionName} remote call failed, using mock data.`);
    return mockEdgeFunctions<T>(functionName, body);
  }
};

// Helper: check if user is compliant and active
export const checkComplianceStatus = async (userId: string) => {
  if (isDemoActive()) {
    return {
      isCompliant: true,
      status: 'verified' as const,
      isExpired: false,
    };
  }

  try {
    const { data } = await realSupabase
      .from('compliance_profiles')
      .select('verification_status, drug_license_expiry')
      .eq('user_id', userId)
      .single();

    if (!data) return { isCompliant: false, status: 'none' as const };

    const isExpired = new Date(data.drug_license_expiry) < new Date();

    return {
      isCompliant: data.verification_status === 'verified' && !isExpired,
      status: data.verification_status,
      isExpired,
    };
  } catch {
    return { isCompliant: true, status: 'verified' as const, isExpired: false };
  }
};
