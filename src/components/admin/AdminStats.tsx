import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAdminStats } from '../../hooks/useDatabase';
import { MetricCard } from '../ui/Card';
import { useColors, Typography, Spacing } from '../../config/theme';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { AppIcons } from '../ui/Icon';

export function AdminStats() {
  const { data: stats, isLoading, isError, refetch } = useAdminStats();
  const { t } = useTranslation();
  const colors = useColors();

  // Failed stats must never render as real zeros — an admin acting on ₹0 GMV
  // or 0 users is acting on fabricated data.
  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: colors.danger }]}>
          {t('common.error')}
        </Text>
        <Text onPress={() => refetch()} style={[styles.loadingText, { color: colors.textLink, marginTop: Spacing.xs }]} accessibilityRole="button">
          {t('common.retry')}
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
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
        value={stats?.pendingDisputes || 0}
        label={t('admin.pendingDisputes')}
        color={stats?.pendingDisputes ? colors.danger : colors.textTertiary}
      />
      <MetricCard
        icon={AppIcons.catalog}
        value={stats?.usersByRole?.MANUFACTURER || 0}
        label={t('auth.manufacturer')}
        color={colors.roleManufacturer}
      />
      <MetricCard
        icon={AppIcons.company}
        value={stats?.usersByRole?.PHARMA_COMPANY || 0}
        label={t('auth.company')}
        color={colors.roleCompany}
      />
      <MetricCard
        icon={AppIcons.stockist}
        value={stats?.usersByRole?.STOCKIST || 0}
        label={t('auth.stockist')}
        color={colors.roleStockist}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
  },
});
