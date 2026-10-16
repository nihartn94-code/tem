/**
 * @jest-environment jsdom
 */
import React from 'react';
jest.mock('../src/lib/supabase', () => {
  const mockInsert = jest.fn().mockResolvedValue({ error: null });
  const mockFrom = jest.fn().mockReturnValue({
    insert: mockInsert,
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  });
  return {
    supabase: {
      auth: {
        signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
        signUp: jest.fn().mockResolvedValue({ error: null }),
        verifyOtp: jest.fn().mockResolvedValue({ error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
      },
      from: mockFrom,
    },
    getCurrentUser: jest.fn().mockResolvedValue({ id: 'test-user-id', email: 'test@test.com' }),
    getUserProfile: jest.fn().mockResolvedValue(null),
  };
});

import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../src/hooks/useAuth';
import { supabase, getUserProfile } from '../src/lib/supabase';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};


describe('useAuth business logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile with email', () => {
    it('should insert email field when isEmail=true', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      // Wait for initial effect
      await act(async () => {});

      let res;
      await act(async () => {
        res = await result.current.createProfile('test@example.com', 'STOCKIST', true);
      });

      expect(res.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('users');
      const insertData = (supabase.from as any)().insert.mock.calls[0][0];
      expect(insertData.email).toBe('test@example.com');
      expect(insertData.phone_number).toBeUndefined();
      expect(insertData.display_name).toBe('test');
      expect(insertData.role).toBe('STOCKIST');
    });

    it('should strip +alias from email for display_name', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await act(async () => {});

      await act(async () => {
        await result.current.createProfile('user+test@example.com', 'MANUFACTURER', true);
      });

      const insertData = (supabase.from as any)().insert.mock.calls[0][0];
      expect(insertData.display_name).toBe('user');
    });
  });

  describe('createProfile with phone', () => {
    it('should insert phone_number field when isEmail=false', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await act(async () => {});

      let res;
      await act(async () => {
        res = await result.current.createProfile('+919876543210', 'PHARMA_COMPANY', false);
      });

      expect(res.success).toBe(true);
      const insertData = (supabase.from as any)().insert.mock.calls[0][0];
      expect(insertData.phone_number).toBe('+919876543210');
      expect(insertData.email).toBeUndefined();
      expect(insertData.display_name).toBe('+919876543210');
    });
  });

  describe('loginWithEmail', () => {
    it('should call signInWithPassword with correct credentials', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await act(async () => {});

      let res;
      await act(async () => {
        res = await result.current.loginWithEmail('test@test.com', 'password123');
      });

      expect(res.success).toBe(true);
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
      });
    });

    it('should return error when login fails', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        error: { message: 'Invalid credentials' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await act(async () => {});

      let res;
      await act(async () => {
        res = await result.current.loginWithEmail('wrong@test.com', 'wrongpass');
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
