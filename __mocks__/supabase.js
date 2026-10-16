const mockSupabase = {
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signInWithOtp: jest.fn(() => Promise.resolve({ error: null })),
    signUp: jest.fn(() => Promise.resolve({ error: null })),
    verifyOtp: jest.fn(() => Promise.resolve({ error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ error: null })),
    signOut: jest.fn(() => Promise.resolve()),
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    order: jest.fn().mockReturnThis(),
  })),
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  functions: {
    invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
};

module.exports = {
  supabase: mockSupabase,
  getCurrentUser: jest.fn(() => Promise.resolve(null)),
  getUserProfile: jest.fn(() => Promise.resolve(null)),
  callEdgeFunction: jest.fn(() => Promise.resolve({})),
  checkComplianceStatus: jest.fn(() => Promise.resolve({ isCompliant: false, status: 'none' })),
};
