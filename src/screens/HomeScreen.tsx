import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '../config/providers';
import type { HomeScreenNavProp, TabParamList } from '../navigation/AppNavigator';
import { Header } from '../components/ui/Header';
import { Card, StatusBadge } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useColors, Typography, Spacing, BorderRadius, useShadows } from '../config/theme';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';
import { supabase, checkComplianceStatus } from '../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PharmaIcon, AppIcons, type IconName } from '../components/ui/Icon';
import { SafeScreen } from '../components/ui/SafeScreen';
import { friendlyError } from '../lib/utils';
import { Config } from '../config';

type QuickAction = {
  icon: IconName;
  labelKey: string;
  screen: keyof TabParamList;
  color: string;
};

export function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const navigation = useNavigation<HomeScreenNavProp>();
  const { user, signOut } = useAuthContext();
  const [isOffline, setIsOffline] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<
    { isCompliant: boolean; status: string; isExpired?: boolean } | null
  >(null);
  const complianceStatusRef = useRef<
    { isCompliant: boolean; status: string; isExpired?: boolean } | null
  >(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Fetch compliance status for non-Admin users
  useEffect(() => {
    if (!user?.id || user?.role === 'ADMIN') {
      setComplianceLoading(false);
      return;
    }
    let cancelled = false;
    const fetchCompliance = async () => {
      try {
        setComplianceLoading(true);
        setComplianceError(null);
        const status = await checkComplianceStatus(user.id);
        if (cancelled) return;
        setComplianceStatus(status);
        if (!status.isCompliant && status.status === 'none') {
          navigation.getParent()?.navigate('Onboarding');
        }
      } catch (err) {
        if (!cancelled) {
          setComplianceError(friendlyError(err, t('common.failedToCheckCompliance')));
        }
      } finally {
        if (!cancelled) setComplianceLoading(false);
      }
    };
    fetchCompliance();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, navigation]);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      Alert.alert(t('common.error'), friendlyError(err, t('common.retry')));
      setSigningOut(false);
    }
  }, [signOut, signingOut]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('common.goodMorning');
    if (hour < 17) return t('common.goodAfternoon');
    return t('common.goodEvening');
  };

  const getRoleActions = (): QuickAction[] => {
    switch (user?.role) {
      case 'STOCKIST':
        return [
          { icon: AppIcons.marketplace, labelKey: t('marketplace.title'), screen: 'Marketplace', color: colors.primary },
          { icon: AppIcons.basket, labelKey: t('basket.title'), screen: 'Basket', color: colors.safe },
          { icon: AppIcons.orders, labelKey: t('orders.title'), screen: 'Orders', color: colors.roleStockist },
          { icon: AppIcons.profile, labelKey: t('common.verified'), screen: 'Profile', color: colors.secondary },
        ];
      case 'PHARMA_COMPANY':
        return [
          { icon: AppIcons.brands, labelKey: t('company.myBrands'), screen: 'Brands', color: colors.roleCompany },
          { icon: AppIcons.orders, labelKey: t('orders.title'), screen: 'Orders', color: colors.safe },
          { icon: AppIcons.catalog, labelKey: t('company.manufacturerSourcing'), screen: 'Brands', color: colors.roleManufacturer },
          { icon: AppIcons.marketplace, labelKey: t('company.listForSale'), screen: 'Brands', color: colors.primary },
        ];
      case 'MANUFACTURER':
        return [
          { icon: AppIcons.catalog, labelKey: t('manufacturer.myCatalog'), screen: 'Catalog', color: colors.roleManufacturer },
          { icon: AppIcons.refresh, labelKey: t('manufacturer.activePools'), screen: 'Catalog', color: colors.pending },
          { icon: AppIcons.orders, labelKey: t('orders.title'), screen: 'Orders', color: colors.safe },
          { icon: AppIcons.scan, labelKey: t('orders.scanBatch'), screen: 'Orders', color: colors.primary },
        ];
      case 'ADMIN':
        return [
          { icon: AppIcons.admin, labelKey: t('admin.dashboard'), screen: 'Admin', color: colors.roleAdmin },
          { icon: AppIcons.alert, labelKey: t('admin.disputes'), screen: 'Admin', color: colors.danger },
          { icon: AppIcons.home, labelKey: t('admin.settings'), screen: 'Admin', color: colors.textSecondary },
          { icon: AppIcons.users, labelKey: t('admin.userManagement'), screen: 'Admin', color: colors.secondary },
        ];
      default:
        return [];
    }
  };

  const actions = getRoleActions();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <SafeScreen
        loading={complianceLoading && !complianceStatus}
        error={complianceError}
        onRetry={() => {
          if (user?.id) {
            setComplianceLoading(true);
            setComplianceError(null);
            checkComplianceStatus(user.id)
              .then(setComplianceStatus)
              .catch((err) => {
                setComplianceError(friendlyError(err, t('common.error')));
                if (complianceStatusRef.current !== null) {
                  setComplianceStatus(complianceStatusRef.current);
                }
              })
              .finally(() => setComplianceLoading(false));
          }
        }}
      >
        <Header
          title={`${getGreeting()}, ${user?.display_name?.split(' ')[0] || 'User'}`}
          subtitle={user?.role?.replace('_', ' ')}
          showRoleBadge
          role={user?.role}
          isOffline={isOffline}
          rightAction={{
            icon: signingOut ? AppIcons.pending : AppIcons.logout,
            label: signingOut ? '...' : t('common.logout'),
            onPress: handleSignOut,
          }}
        />
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
          {/* Hero Section — Value Proposition */}
          <Card style={[styles.heroCard, { backgroundColor: colors.primarySurface }]} elevated>
            <View style={styles.heroIconContainer}>
              <PharmaIcon name={AppIcons.pill} size={40} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              PharmaOS
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              {t('home.heroSubtitle')}
            </Text>
            <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>
              {t('home.heroDescription')}
            </Text>
          </Card>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <Card style={styles.statCard} elevated>
              <PharmaIcon name={AppIcons.verified} size={24} color={colors.safe} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{t('home.statVerifiedValue')}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.statVerifiedLabel')}</Text>
            </Card>
            <Card style={styles.statCard} elevated>
              <PharmaIcon name={AppIcons.truck} size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{t('home.statDeliveryValue')}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.statDeliveryLabel')}</Text>
            </Card>
            <Card style={styles.statCard} elevated>
              <PharmaIcon name={AppIcons.handshake} size={24} color={colors.secondary} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{t('home.statSecureValue')}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.statSecureLabel')}</Text>
            </Card>
          </View>

          {/* Offline Banner */}
          {isOffline && (
            <View style={[styles.offlineBanner, { backgroundColor: colors.pendingSurface, borderColor: colors.pending }]}>
              <PharmaIcon name={AppIcons.wifiOff} size={24} color={colors.pending} />
              <View style={styles.offlineInfo}>
                <Text style={[styles.offlineTitle, { color: colors.pending }]}>{t('common.offline')}</Text>
                <Text style={[styles.offlineText, { color: colors.textSecondary }]}>{t('common.syncing')}</Text>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('common.quickActions')}</Text>
            <View style={styles.actionsGrid}>
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.labelKey}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                    },
                    signingOut && styles.actionCardDisabled,
                  ]}
                  onPress={() => navigation.navigate(action.screen as keyof TabParamList)}
                  activeOpacity={0.7}
                  disabled={signingOut}
                  accessibilityRole="button"
                  accessibilityLabel={action.labelKey}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                    <PharmaIcon name={action.icon} size={28} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.textPrimary }]} numberOfLines={2}>
                    {action.labelKey}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Compliance Status — SRS §3.1 */}
          {user?.role !== 'ADMIN' && complianceStatus && (
            <Card style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                    {t('common.complianceStatus')}
                  </Text>
                  <StatusBadge
                    status={complianceStatus.isCompliant ? 'safe' : complianceStatus.status === 'pending' ? 'pending' : 'danger'}
                    label={complianceStatus.isCompliant ? t('common.verified') + '' : complianceStatus.status === 'pending' ? t('common.underReview') : complianceStatus.isExpired ? t('common.licenseExpired') : t('common.onboardingRequired')}
                    size="sm"
                  />
                </View>
                {!complianceStatus.isCompliant && (
                  <Button
                    title={complianceStatus.status === 'none' ? t('common.complete') + ' →' : t('common.update') + ' →'}
                    onPress={() => navigation.getParent()?.navigate('Onboarding')}
                    variant="primary"
                    size="sm"
                    iconName={AppIcons.forward}
                  />
                )}
              </View>
            </Card>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
              {t('app.name')} {Config.app.version} • Built for Indian Pharma
            </Text>
          </View>
        </ScrollView>
      </SafeScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  heroCard: {
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  heroIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(27, 94, 32, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    ...Typography.hero,
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  heroDescription: {
    ...Typography.body,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statValue: {
    ...Typography.h2,
    marginTop: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  offlineInfo: { flex: 1, marginLeft: Spacing.md },
  offlineTitle: { ...Typography.body, fontWeight: '700' },
  offlineText: { ...Typography.caption, marginTop: 2 },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.h2, marginBottom: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  actionCard: {
    width: '47%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    minHeight: 110,
    borderWidth: 1,
  },
  actionCardDisabled: { opacity: 0.5 },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusCard: { marginBottom: Spacing.xl },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusInfo: { flex: 1 },
  statusLabel: { ...Typography.caption, marginBottom: Spacing.xs },
  footer: { alignItems: 'center', paddingVertical: Spacing.xl },
  footerText: { ...Typography.caption },
});
