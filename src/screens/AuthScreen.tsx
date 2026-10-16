import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from '../config/providers';
import { PhoneInput, Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useColors, Typography, Spacing, useShadows } from '../config/theme';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons, type IconName } from '../components/ui/Icon';

type AuthStep = 'phone' | 'otp' | 'role';

const ROLES = [
  { value: 'MANUFACTURER', icon: AppIcons.catalog as IconName, labelKey: 'auth.manufacturer', color: '#7B1FA2' },
  { value: 'PHARMA_COMPANY', icon: AppIcons.company as IconName, labelKey: 'auth.company', color: '#1565C0' },
  { value: 'STOCKIST', icon: AppIcons.stockist as IconName, labelKey: 'auth.stockist', color: '#00695C' },
] as const;

export function AuthScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const { sendOTP, verifyOTP, createProfile, loginWithEmail, loading, error } = useAuthContext();

  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('email');
  const [isNewUser, setIsNewUser] = useState(false);
  const [showTestAccounts, setShowTestAccounts] = useState(__DEV__);

  // SECURITY: Test accounts only available in development builds
  const TEST_ACCOUNTS = __DEV__ ? [
    { email: 'admin@pharmaos.io', password: 'Admin123!', role: 'ADMIN', label: 'Admin' },
    { email: 'mfg@pharmaos.io', password: 'MfgPass123!', role: 'MANUFACTURER', label: 'Manufacturer' },
    { email: 'company@pharmaos.io', password: 'Company123!', role: 'PHARMA_COMPANY', label: 'Company' },
    { email: 'stockist@pharmaos.io', password: 'Stock123!', role: 'STOCKIST', label: 'Stockist' },
  ] : [];

  const handleQuickLogin = useCallback(async (testEmail: string, testPassword: string) => {
    setEmail(testEmail);
    setPassword(testPassword);
    const result = await loginWithEmail(testEmail, testPassword);
    if (!result.success) {
      Alert.alert(t('common.error'), result.error || t('auth.loginFailed'));
    }
  }, [loginWithEmail, t]);

  const handleSendOTP = useCallback(async () => {
    if (phone.length < 10) {
      Alert.alert(t('auth.enterCredentials'));
      return;
    }
    const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    const result = await sendOTP(fullPhone);
    if (result.success) {
      setOtpSentTo(fullPhone);
      setIsNewUser(result.isNewUser || false);
      setStep('otp');
    }
  }, [phone, sendOTP, t]);

  const handleVerifyOTP = useCallback(async () => {
    if (otp.length !== 6) return;
    const result = await verifyOTP(otpSentTo, otp);
    if (result.success) {
      if (result.profile) {
        // Existing user — already logged in, onAuthStateChange handles navigation
      } else {
        // No profile row → role selection + profile creation.
        // Previously a verified OTP with no profile silently no-op'd,
        // stranding the user on the OTP step (audit M35)
        setIsNewUser(true);
        setStep('role');
      }
    }
  }, [otp, otpSentTo, verifyOTP]);

  const handleRoleSelect = useCallback(async () => {
    if (!selectedRole) return;
    const isEmailLogin = authMode === 'email';
    const identifier = isEmailLogin ? email : otpSentTo;
    if (!identifier) {
      Alert.alert(t('common.error'), t('common.error'));
      return;
    }
    const result = await createProfile(identifier, selectedRole, isEmailLogin);
    if (!result.success) {
      Alert.alert(t('common.error'), result.error || t('common.error'));
    }
  }, [selectedRole, otpSentTo, email, authMode, createProfile]);

  const handleEmailLogin = useCallback(async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.emailRequired'));
      return;
    }
    if (!password) {
      Alert.alert(t('common.error'), t('auth.passwordRequired'));
      return;
    }
    const result = await loginWithEmail(email, password);
    if (result.success) {
      if (result.profile) {
        // Existing user — onAuthStateChange handles navigation
      } else {
        // Auth user exists but no profile — needs onboarding
        setStep('role');
        setIsNewUser(true);
      }
    } else {
      Alert.alert(t('common.error'), result.error || t('common.error'));
    }
  }, [email, password, loginWithEmail, t]);

  const handleResendOTP = useCallback(async () => {
    const result = await sendOTP(otpSentTo);
    if (result.success) {
      Alert.alert(t('auth.otpSent'), otpSentTo);
    }
  }, [otpSentTo, sendOTP, t]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Brand Header */}
          <View style={styles.brandSection}>
            <View style={[styles.logoContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <PharmaIcon name={AppIcons.pill} size={40} color={colors.primaryText} />
            </View>
            <Text style={[styles.brandName, { color: colors.primaryText }]}>{t('app.name')}</Text>
            <Text style={[styles.tagline, { color: colors.primaryText, opacity: 0.8 }]}>
              {t('app.tagline')}
            </Text>
          </View>

          {/* Email Login Option */}
          {step === 'phone' && authMode === 'email' && (
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {t('auth.emailLogin')}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                {t('auth.emailLoginSubtitle')}
              </Text>

              <Input
                label={t('auth.emailLabel')}
                value={email}
                onChangeText={setEmail}
                placeholder="name@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Input
                label={t('auth.passwordLabel')}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry
              />

              <Button
                title={t('auth.signIn')}
                onPress={handleEmailLogin}
                loading={loading}
                fullWidth
                size="lg"
              />

              <Button
                title={t('auth.usePhoneInstead')}
                onPress={() => setAuthMode('phone')}
                variant="ghost"
                fullWidth
                style={styles.switchModeButton}
              />
            </Card>
          )}

          {/* Quick Test Login — only in development */}
          {step === 'phone' && authMode === 'email' && showTestAccounts && (
            <Card style={[styles.testCard, { backgroundColor: colors.pendingSurface, borderColor: colors.pending }]}>
              <Text style={[styles.testTitle, { color: colors.textPrimary }]}>Quick Test Login</Text>
              <Text style={[styles.testSubtitle, { color: colors.textSecondary }]}>
                Tap a role to login instantly
              </Text>
              <View style={styles.testGrid}>
                {TEST_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    title={account.label}
                    onPress={() => handleQuickLogin(account.email, account.password)}
                    loading={loading}
                    variant="secondary"
                    size="sm"
                    style={styles.testButton}
                  />
                ))}
              </View>
            </Card>
          )}

          {/* Phone OTP Option */}
          {step === 'phone' && authMode === 'phone' && (
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {t('auth.loginTitle')}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                {t('auth.loginSubtitle')}
              </Text>

              <PhoneInput
                label={t('auth.enterPhone')}
                value={phone}
                onChangeText={setPhone}
                placeholder="9876543210"
                error={error || undefined}
              />

              <Button
                title={t('auth.sendOTP')}
                onPress={handleSendOTP}
                loading={loading}
                fullWidth
                size="lg"
              />

              <Button
                title={t('auth.useEmailInstead')}
                onPress={() => setAuthMode('email')}
                variant="ghost"
                fullWidth
                style={styles.switchModeButton}
              />
            </Card>
          )}

          {/* Step 2: OTP Verification */}
          {step === 'otp' && (
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {t('auth.enterOTP')}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                {t('auth.otpSent')} {otpSentTo}
              </Text>

              <Input
                label={t('auth.enterOTP')}
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                leftIcon="camera"
              />

              <Button
                title={t('auth.verify')}
                onPress={handleVerifyOTP}
                loading={loading}
                fullWidth
                size="lg"
                disabled={otp.length !== 6}
              />

              <Button
                title={t('auth.resendOTP')}
                onPress={handleResendOTP}
                variant="ghost"
                fullWidth
                style={styles.resendButton}
              />
            </Card>
          )}

          {/* Step 3: Role Selection (new users only) */}
          {step === 'role' && (
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {t('auth.selectRole')}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Choose your role in the pharma supply chain
              </Text>

              {ROLES.map((role) => (
                <Button
                  key={role.value}
                  title={t(role.labelKey)}
                  onPress={() => setSelectedRole(role.value)}
                  variant={selectedRole === role.value ? 'primary' : 'ghost'}
                  fullWidth
                  size="lg"
                  iconName={role.icon}
                  style={styles.roleButton}
                />
              ))}

              <Button
                title={t('auth.continue')}
                onPress={handleRoleSelect}
                loading={loading}
                fullWidth
                size="lg"
                disabled={!selectedRole}
                style={styles.continueButton}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xxl },
  brandSection: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  brandName: {
    ...Typography.hero,
    marginBottom: Spacing.xs,
  },
  tagline: {
    ...Typography.body,
  },
  card: { padding: Spacing.xl },
  cardTitle: {
    ...Typography.h1,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xl,
  },
  switchModeButton: { marginTop: Spacing.md },
  resendButton: { marginTop: Spacing.md },
  roleButton: { marginBottom: Spacing.sm },
  continueButton: { marginTop: Spacing.lg },
  testCard: {
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
  },
  testTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  testSubtitle: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  testGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  testButton: { flex: 1, minWidth: '45%' },
});
