import Constants from 'expo-constants';

const ENV = {
  EXPO_PUBLIC_SUPABASE_URL: Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE || '',
};

export const Config = {
  supabase: {
    url: ENV.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    demoMode:
      ENV.EXPO_PUBLIC_DEMO_MODE === 'true' ||
      ENV.EXPO_PUBLIC_DEMO_MODE === '' ||
      !ENV.EXPO_PUBLIC_SUPABASE_URL ||
      ENV.EXPO_PUBLIC_SUPABASE_URL.includes('your-project') ||
      ENV.EXPO_PUBLIC_SUPABASE_URL.includes('gmynykiwnvairngkvtdl'),
  },
  // FINAL_MASTER_PROMPT.md §2: No Razorpay, no Cashfree, no paid gateway.
  // UPI manual confirmation mode: generate upi://pay deep-link, seller/Admin manually marks "Payment Received".
  payment: {
    mode: 'MANUAL_CONFIRMATION' as const,
    upiId: 'pharmaos@upi',
    upiPayeeName: 'PharmaOS Trade',
  },
  app: {
    name: 'PharmaOS',
    version: '2.1.0',
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'hi'],
  },
  compliance: {
    deliveryRadiusKm: 50,
    autoFlagDisputeThreshold: 3,
  },
} as const;
