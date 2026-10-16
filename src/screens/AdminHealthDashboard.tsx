import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/ui/Header';
import { Card, MetricCard, SectionHeader, StatusBadge } from '../components/ui/Card';
import { SkeletonCard } from '../components/ui/SkeletonLoader';
import { ErrorState } from '../components/ui/ErrorState';
import { useAdminStats, useDisputes } from '../hooks/useDatabase';
import { useSystemHealth } from '../hooks/useSystemHealth';
import type { DisputeTicket } from '../lib/types';
import { useColors, Typography, Spacing } from '../config/theme';
import { formatCurrency } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';

export function AdminHealthDashboard() {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useAdminStats();
  const { data: disputes, isLoading: disputesLoading, isError: disputesError, refetch: refetchDisputes } = useDisputes();
  const { health, checkHealth } = useSystemHealth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  type DisputeWithReason = DisputeTicket & { reason: string };
  const pendingDisputes = (disputes as DisputeWithReason[] | undefined)?.filter((d) => d.resolution === 'PENDING') || [];
  const recentDisputes = disputes?.slice(0, 5) || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchDisputes(), checkHealth()]);
    setRefreshing(false);
  };

  if (statsLoading || disputesLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
        <Header title={t('admin.health')} subtitle={t('admin.networkHealth')} />
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
          <View style={styles.statsGrid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (statsError || disputesError) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
        <Header title={t('admin.health')} subtitle={t('admin.networkHealth')} />
        <ErrorState
          title={t('common.error')}
          message={t('errors.loadDashboard')}
          onRetry={() => { refetchStats(); refetchDisputes(); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header title={`${t('admin.health')}`} subtitle={t('admin.networkHealth')} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Key Metrics */}
        <View style={styles.statsGrid}>
          <MetricCard
            icon={AppIcons.rupee}
            value={formatCurrency(stats?.totalGMV || 0)}
            label={t('admin.gmv')}
            color={colors.safe}
          />
          <MetricCard
            icon={AppIcons.users}
            value={stats?.activeUsers || 0}
            label={t('admin.activeAccounts')}
            color={colors.secondary}
          />
          <MetricCard
            icon={AppIcons.alert}
            value={pendingDisputes.length}
            label={t('admin.pendingDisputes')}
            color={pendingDisputes.length > 0 ? colors.danger : colors.textTertiary}
          />
        </View>

        {/* Users by Role */}
        <Card style={styles.section}>
          <SectionHeader icon={AppIcons.users} title={t('admin.usersByRole')} />
          <View style={styles.roleRow}>
            <View style={styles.roleItem}>
              <PharmaIcon name={AppIcons.catalog} size={28} color={colors.roleManufacturer} />
              <Text style={[styles.roleCount, { color: colors.textPrimary }]}>
                {stats?.usersByRole?.MANUFACTURER || 0}
              </Text>
              <Text style={[styles.roleLabel, { color: colors.textSecondary }]}>
                {t('auth.manufacturer')}
              </Text>
            </View>
            <View style={styles.roleItem}>
              <PharmaIcon name={AppIcons.company} size={28} color={colors.roleCompany} />
              <Text style={[styles.roleCount, { color: colors.textPrimary }]}>
                {stats?.usersByRole?.PHARMA_COMPANY || 0}
              </Text>
              <Text style={[styles.roleLabel, { color: colors.textSecondary }]}>
                {t('auth.company')}
              </Text>
            </View>
            <View style={styles.roleItem}>
              <PharmaIcon name={AppIcons.stockist} size={28} color={colors.roleStockist} />
              <Text style={[styles.roleCount, { color: colors.textPrimary }]}>
                {stats?.usersByRole?.STOCKIST || 0}
              </Text>
              <Text style={[styles.roleLabel, { color: colors.textSecondary }]}>
                {t('auth.stockist')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Recent Disputes */}
        <Card style={styles.section}>
          <SectionHeader
            icon={AppIcons.handshake}
            title={t('admin.recentDisputes')}
            action={`${pendingDisputes.length} pending`}
          />
          {recentDisputes.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {t('admin.noDisputesYet')}
            </Text>
          ) : (
            recentDisputes.map((dispute: DisputeWithReason) => (
              <View
                key={dispute.id}
                style={[styles.disputeRow, { borderBottomColor: colors.borderLight }]}
              >
                <View style={styles.disputeInfo}>
                  <Text style={[styles.disputeReason, { color: colors.textPrimary }]}>
                    {dispute.reason?.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.disputeDate, { color: colors.textTertiary }]}>
                    {new Date(dispute.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <StatusBadge
                  status={dispute.resolution === 'PENDING' ? 'pending' : 'safe'}
                  label={dispute.resolution === 'PENDING' ? t('common.pending') : t('common.resolved')}
                  size="sm"
                />
              </View>
            ))
          )}
        </Card>

        {/* System Status */}
        <Card style={styles.section}>
          <SectionHeader icon={AppIcons.server} title={t('admin.systemStatus')} />
          <View style={[styles.systemRow, { borderBottomColor: colors.borderLight }]}>
            <PharmaIcon
              name={AppIcons.database}
              size={18}
              color={
                health.supabase === 'healthy'
                  ? colors.safe
                  : health.supabase === 'checking'
                  ? colors.pending
                  : colors.danger
              }
            />
            <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>
              {t('admin.supabase')}
            </Text>
            <StatusBadge
              status={health.supabase === 'healthy' ? 'safe' : health.supabase === 'checking' ? 'pending' : 'danger'}
              label={health.supabase === 'healthy' ? t('admin.connected') : health.supabase === 'checking' ? 'Checking...' : 'Disconnected'}
              size="sm"
            />
          </View>
          <View style={[styles.systemRow, { borderBottomColor: colors.borderLight }]}>
            <PharmaIcon
              name={AppIcons.server}
              size={18}
              color={
                health.backend === 'healthy'
                  ? colors.safe
                  : health.backend === 'checking'
                  ? colors.pending
                  : colors.danger
              }
            />
            <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Backend</Text>
            <StatusBadge
              status={health.backend === 'healthy' ? 'safe' : health.backend === 'checking' ? 'pending' : 'danger'}
              label={health.backend === 'healthy' ? t('admin.deployed') : health.backend === 'checking' ? 'Checking...' : 'Unavailable'}
              size="sm"
            />
          </View>
          <View style={[styles.systemRow, { borderBottomColor: colors.borderLight }]}>
            <PharmaIcon
              name={AppIcons.database}
              size={18}
              color={
                health.database === 'healthy'
                  ? colors.safe
                  : health.database === 'checking'
                  ? colors.pending
                  : colors.danger
              }
            />
            <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Database</Text>
            <StatusBadge
              status={health.database === 'healthy' ? 'safe' : health.database === 'checking' ? 'pending' : 'danger'}
              label={health.database === 'healthy' ? 'Operational' : health.database === 'checking' ? 'Checking...' : 'Error'}
              size="sm"
            />
          </View>
          <View style={[styles.systemRow, { borderBottomColor: colors.borderLight }]}>
            <PharmaIcon name={AppIcons.warning} size={18} color={colors.pending} />
            <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>
              {t('admin.paymentGateway')}
            </Text>
            <StatusBadge status="pending" label={t('admin.upiManualMode')} size="sm" />
          </View>
          {health.lastChecked && (
            <Text style={[styles.lastChecked, { color: colors.textTertiary }]}>
              Last checked: {health.lastChecked.toLocaleTimeString()}
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  statsGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  roleRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.md },
  roleItem: { alignItems: 'center' },
  roleCount: { ...Typography.number, fontSize: 24, marginTop: Spacing.xs },
  roleLabel: { ...Typography.caption },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  disputeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  disputeInfo: { flex: 1 },
  disputeReason: { ...Typography.bodySmall, fontWeight: '500' },
  disputeDate: { ...Typography.caption },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  systemLabel: { ...Typography.bodySmall, flex: 1 },
  lastChecked: { ...Typography.caption, textAlign: 'right', marginTop: Spacing.sm },
});
