import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { loadSavedLanguage } from './i18n';
import type { User } from '../lib/types';

// Perf (§23): cache-first UX — 60s staleTime means navigations render
// instantly from cache and revalidate in the background; failed queries
// retry with backoff; mutations don't retry (idempotency is server-enforced).
const queryClient = new QueryClient({
 defaultOptions: {
 queries: {
 retry: 2,
 retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
 staleTime: 60_000,
 gcTime: 10 * 60_000,
 refetchOnWindowFocus: false,
 refetchOnReconnect: true,
 },
 mutations: {
 retry: 0,
 },
 },
});

interface AuthContextType {
 user: User | null;
 loading: boolean;
 error: string | null;
 isAuthenticated: boolean;
 sendOTP: (phone: string) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
 verifyOTP: (phone: string, otp: string) => Promise<{ success: boolean; profile?: User | null; error?: string }>;
 createProfile: (phoneOrEmail: string, role: string, isEmail?: boolean) => Promise<{ success: boolean; profile?: User | null; error?: string }>;
 signOut: () => Promise<void>;
 loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; profile?: User | null; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
 const context = useContext(AuthContext);
 if (!context) {
 throw new Error('useAuthContext must be used within AppProviders');
 }
 return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
 const auth = useAuth();

 return (
 <AuthContext.Provider value={auth}>
 {children}
 </AuthContext.Provider>
 );
}

export function AppProviders({ children }: { children: ReactNode }) {
 useEffect(() => {
 loadSavedLanguage();
 }, []);

 return (
 <QueryClientProvider client={queryClient}>
 <AuthProvider>
 {children}
 </AuthProvider>
 </QueryClientProvider>
 );
}
