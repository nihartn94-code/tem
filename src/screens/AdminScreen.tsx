import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Header } from '../components/ui/Header';
import { AdminStats } from '../components/admin/AdminStats';
import { DisputeCard } from '../components/admin/DisputeCard';
import { PlatformSettingsForm } from '../components/admin/PlatformSettingsForm';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { SkeletonCard } from '../components/ui/SkeletonLoader';
import { Button } from '../components/ui/Button';
import { useDisputes } from '../hooks/useDatabase';
import type { DisputeTicket } from '../lib/types';
import { useColors, Typography, Spacing, BorderRadius } from '../config/theme';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';

type AdminTab = 'dashboard' | 'disputes' | 'settings';

export function AdminScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const { data: disputes, isLoading: disputesLoading, isError: disputesError, refetch: refetchDisputes } = useDisputes();

  type DisputeWithRelations = DisputeTicket & {
    order?: { quantity: number; gross_invoice_value: number; declared_batch_number: string; scanned_batch_number: string };
    raiser?: { display_name: string };
    resolver?: { display_name: string };
  };

  const pendingDisputes = (disputes as DisputeWithRelations[] | undefined)?.filter((d) => d.resolution === 'PENDING') || [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('admin.dashboard')}
        subtitle={t('admin.platformAdministration')}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
          {([
            { key: 'dashboard' as AdminTab, icon: AppIcons.admin, label: t('admin.dashboard') },
            { key: 'disputes' as AdminTab, icon: AppIcons.alert, label: `${t('admin.disputes')} (${pendingDisputes.length})` },
            { key: 'settings' as AdminTab, icon: AppIcons.home, label: t('admin.settings') },
          ]).map((tab) => (
            <Button
              key={tab.key}
              title={tab.label}
              onPress={() => setActiveTab(tab.key)}
              variant={activeTab === tab.key ? 'primary' : 'ghost'}
              size="sm"
              iconName={tab.icon}
              style={styles.tabButton}
            />
          ))}
        </View>

        {/* Quick Actions Row */}
        <View style={[styles.actionsRow, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
          <Button
            title={t('admin.broadcast')}
            onPress={() => navigation.getParent()?.navigate('Broadcast')}
            variant="secondary"
            size="sm"
            iconName={AppIcons.broadcast}
            style={styles.actionButton}
          />
          <Button
            title={t('admin.health')}
            onPress={() => navigation.getParent()?.navigate('HealthDashboard')}
            variant="secondary"
            size="sm"
            iconName={AppIcons.database}
            style={styles.actionButton}
          />
        </View>

        {/* Tab Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {activeTab === 'dashboard' && (
            <>
              <AdminStats />
              {pendingDisputes.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    {t('admin.pendingDisputes')} ({pendingDisputes.length})
                  </Text>
                  {pendingDisputes.slice(0, 3).map((dispute) => (
                    <DisputeCard key={dispute.id} dispute={dispute} />
                  ))}
                </View>
              )}
            </>
          )}

          {activeTab === 'disputes' && (
            <>
              {disputesLoading && (
                <View>
                  <SkeletonCard />
                  <SkeletonCard />
                </View>
              )}
              {disputesError && (
                <ErrorState
                  title={t('common.error')}
                  message={t('errors.loadDisputes')}
                  onRetry={refetchDisputes}
                />
              )}
              {!disputesLoading && !disputesError && pendingDisputes.length === 0 && (
                <EmptyState
                  icon={AppIcons.verified}
                  title={t('admin.allClear')}
                  message={t('admin.noPendingDisputes')}
                />
              )}
              {!disputesLoading && !disputesError && pendingDisputes.length > 0 && (
                pendingDisputes.map((dispute) => (
                  <DisputeCard key={dispute.id} dispute={dispute} />
                ))
              )}
            </>
          )}

          {activeTab === 'settings' && <PlatformSettingsForm />}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  tabButton: { flex: 1 },
  content: { flex: 1 },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  section: { marginTop: Spacing.xl },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  actionButton: { flex: 1 },
});
