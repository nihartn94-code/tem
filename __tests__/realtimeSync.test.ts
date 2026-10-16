/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeSync } from '../src/hooks/useRealtimeSync';

const channelHandlers: Record<string, Function> = {};
const mockChannel = {
  on: jest.fn((type: string, _filter: unknown, handler: Function) => {
    channelHandlers[type] = handler;
    return mockChannel;
  }),
  subscribe: jest.fn(() => mockChannel),
};

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/config/providers', () => ({
  useAuthContext: jest.fn(),
}));

const { useAuthContext } = jest.requireMock('../src/config/providers') as {
  useAuthContext: jest.Mock;
};

const render = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { invalidateSpy, ...renderHook(() => useRealtimeSync(true), { wrapper }) };
};

describe('useRealtimeSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useAuthContext.mockReturnValue({ user: { id: 'u1' } });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('subscribes one channel with orders + disputes listeners and cleans up', () => {
    const { unmount } = render();
    expect(mockChannel.on).toHaveBeenCalledTimes(2);
    expect(mockChannel.subscribe).toHaveBeenCalled();
    unmount();
  });

  it('does not subscribe when disabled or logged out', () => {
    useAuthContext.mockReturnValue({ user: null });
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    renderHook(() => useRealtimeSync(false), { wrapper });
    expect(mockChannel.subscribe).not.toHaveBeenCalled();
  });

  it('bursts of order events collapse into one debounced invalidation', async () => {
    const { invalidateSpy } = render();
    const handler = channelHandlers['postgres_changes'];
    expect(handler).toBeDefined();
    act(() => {
      handler({}, null);
      handler({}, null);
      handler({}, null);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2); // orders + disputes, once
  });
});
