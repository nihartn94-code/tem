import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, getCurrentUser, getUserProfile } from '../lib/supabase';
import { friendlyError } from '../lib/utils';
import type { User } from '../lib/types';

export function useAuth() {
 const queryClient = useQueryClient();
 const [user, setUser] = useState<User | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 const init = async () => {
 try {
 const authUser = await getCurrentUser();
 if (authUser) {
 const profile = await getUserProfile();
 setUser(profile);
 }
 } catch (err) {
 setError(friendlyError(err, 'Auth init failed'));
 } finally {
 setLoading(false);
 }
 };

 init();

 const { data: { subscription } } = supabase.auth.onAuthStateChange(
 async (event, session) => {
 if (session?.user) {
 const profile = await getUserProfile();
 if (profile) {
 setUser(profile);
 } else if (event === 'INITIAL_SESSION') {
 // Auth user without a profile row → onboarding path
 setUser(null);
 }
 // Transient profile fetch failure on token refresh: keep the current
 // session — never bounce the user to login mid-app (audit M16)
 } else {
 setUser(null);
 }
 setLoading(false);
 }
 );

 return () => subscription.unsubscribe();
 }, []);

/**
 * Send OTP to a phone number. Handles both existing and new users:
 * 1. Try signInWithOtp (works for existing users)
 * 2. If that fails, call signUp to create the auth user, then send OTP
 * 3. Return success/failure with isNewUser flag
 * Phone must be in E.164 format (+919876543210) or numeric string without country code
 */
const sendOTP = useCallback(async (phone: string) => {
 setLoading(true);
 setError(null);
 try {
  // Normalize phone: keep if already E.164, else prepend +91 (India)
  const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
  // Try existing user first
  const { error: signInError } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });

  if (signInError) {
   // User doesn't exist — create them first, then send OTP
   const { error: signUpError } = await supabase.auth.signUp({
    phone: normalizedPhone,
    password: crypto.randomUUID(), // Required by Supabase but unused — we use OTP
   });
   if (signUpError) throw signUpError;

   // Now send OTP to the newly created user
   const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });
   if (otpError) throw otpError;

   return { success: true, isNewUser: true };
  }

  return { success: true, isNewUser: false };
 } catch (err) {
  const message = friendlyError(err, 'Failed to send OTP');
  setError(message);
  return { success: false, error: message, isNewUser: false };
 } finally {
  setLoading(false);
 }
}, []);

 /**
 * Verify OTP and return the user profile (or null for new users who need role selection).
 */
 const verifyOTP = useCallback(async (phone: string, otp: string) => {
 setLoading(true);
 setError(null);
 try {
 const { error: verifyError } = await supabase.auth.verifyOtp({
 phone,
 token: otp,
 type: 'sms',
 });
 if (verifyError) throw verifyError;

 // Check if user profile exists
 const profile = await getUserProfile();
 setUser(profile);
 return { success: true, profile };
 } catch (err) {
 const message = friendlyError(err, 'OTP verification failed');
 setError(message);
 return { success: false, error: message };
 } finally {
 setLoading(false);
 }
 }, []);

 /**
 * Create user profile row (for new users after OTP verification).
 * The auth user already exists from the signUp in sendOTP.
 */ const createProfile = useCallback(async (phoneOrEmail: string, role: string, isEmail = false) => {
   setLoading(true);
   setError(null);
   try {
     const authUser = await getCurrentUser();
     if (!authUser) throw new Error('No authenticated user');

     const insertData: { auth_user_id: string; role: string; display_name: string; preferred_language: string; phone_number?: string; email?: string } = {
       auth_user_id: authUser.id,
       role: role as User['role'],
       display_name: isEmail ? phoneOrEmail.split('@')[0].split('+')[0] : phoneOrEmail,
       preferred_language: 'en',
     };

     if (isEmail) {
       insertData.email = phoneOrEmail;
       // phone_number is nullable for email users
     } else {
       insertData.phone_number = phoneOrEmail;
     }

     const { error: profileError } = await supabase
       .from('users')
       .insert(insertData);
     if (profileError) throw profileError;

     // Refresh profile
     const profile = await getUserProfile();
     setUser(profile);
     return { success: true, profile };
   } catch (err) {
     const message = friendlyError(err, 'Profile creation failed');
     setError(message);
     return { success: false, error: message };
   } finally {
     setLoading(false);
   }
 }, []);

 
 /**
 * Email+password login (fallback when phone OTP is disabled).
 */
 const loginWithEmail = useCallback(async (email: string, password: string) => {
   setLoading(true);
   setError(null);
   try {
     const { error: signInError } = await supabase.auth.signInWithPassword({
       email,
       password,
     });
     if (signInError) throw signInError;

     const profile = await getUserProfile();
     if (!profile) {
       // User exists in auth but has no profile row — needs onboarding
       return { success: true, profile: null };
     }
     setUser(profile);
     return { success: true, profile };
   } catch (err) {
     // Map to friendly copy at the source — every consumer (§24: never
     // surface raw backend/network messages to the user)
     setError(friendlyError(err, 'Login failed'));
     return { success: false, error: friendlyError(err, 'Login failed') };
   } finally {
     setLoading(false);
   }
 }, []);

 const signOut = useCallback(async () => {
 await supabase.auth.signOut();
 setUser(null);
 // Purge user-scoped caches — the next login must not inherit
 // orders/disputes/stats from the previous session (audit M17)
 queryClient.clear();
 }, []);

 return {
 user,
 loading,
 error,
 sendOTP,
 verifyOTP,
 createProfile,
 signOut,
 isAuthenticated: !!user,
 loginWithEmail,
 };
}
