import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/ui/Header';
import { Card, StatusBadge, SectionHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { OrderTimeline } from '../components/orders/OrderTimeline';
import { ScreenLoader } from '../components/ui/SkeletonLoader';
import { ErrorState } from '../components/ui/ErrorState';
import { useOrderDetail } from '../hooks/useDatabase';
import { useAuthContext } from '../config/providers';
import { useColors, Typography, Spacing, BorderRadius } from '../config/theme';
import { formatCurrency, formatDate } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import type { OrderState } from '../lib/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export function OrderDetailScreen({ route, navigation }: Props) {
  const orderId = route.params?.orderId || '';
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuthContext();
  const { data: order, isLoading, isError, error, refetch } = useOrderDetail(orderId);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
        <Header title={t('common.loading')} />
        <ScreenLoader message={t('common.loading')} />
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
        <Header
          title={t('orders.orderNumber') + orderId.slice(0, 8)}
          rightAction={{ icon: AppIcons.back, label: 'Back', onPress: () => navigation.goBack() }}
        />
        <ErrorState
          title={t('common.error')}
          message={error?.message || t('common.orderNotFound')}
          onRetry={isError ? refetch : undefined}
        />
      </SafeAreaView>
    );
  }

  const state = order.state as OrderState;
  const canScanBatch = order.buyer_id === user?.id && state === 'DELIVERED_PENDING_SCAN';

  const getStatusLabel = (s: OrderState) => {
    const map: Record<string, string> = {
      POOLING_ACTIVE: t('common.pooling'), BATCH_LOCKED: t('common.batchLocked'), IN_PRODUCTION: t('common.inProduction'),
      DISPATCHED: t('common.dispatched'), DELIVERED_PENDING_SCAN: t('common.awaitingScan'),
      DELIVERED_CONFIRMED: t('common.delivered'), DISPUTED: t('common.underDispute'), SETTLED: t('common.settled'), REFUNDED: t('common.refunded'),
    };
    return map[s] || s;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={`${t('orders.orderNumber')}${order.id.slice(0, 8)}`}
        subtitle={getStatusLabel(state)}
        rightAction={{ icon: AppIcons.back, label: 'Back', onPress: () => navigation.goBack() }}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <PharmaIcon
              name={state === 'SETTLED' ? AppIcons.safe : state === 'DISPUTED' ? AppIcons.alert : AppIcons.orders}
              size={32}
              color={state === 'SETTLED' ? colors.safe : state === 'DISPUTED' ? colors.danger : colors.pending}
            />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: colors.textPrimary }]}>
                {getStatusLabel(state)}
              </Text>
              <Text style={[styles.statusDate, { color: colors.textSecondary }]}>
                {formatDate(order.created_at)}
              </Text>
            </View>
            <StatusBadge
              status={state === 'SETTLED' || state === 'DELIVERED_CONFIRMED' ? 'safe' : state === 'DISPUTED' ? 'danger' : 'pending'}
              label={getStatusLabel(state)}
              size="sm"
            />
          </View>
        </Card>

        <Card style={styles.timelineCard}>
          <OrderTimeline currentState={state} />
        </Card>

        <Card style={styles.detailsCard}>
          <SectionHeader icon={AppIcons.admin} title={t('orders.title')} />
          <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orderDetail.quantity')}</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{t('orderDetail.units', { count: order.quantity })}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orderDetail.grossValue')}</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {formatCurrency(Number(order.gross_invoice_value))}
            </Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              {t('orderDetail.platformFee', { pct: order.platform_fee_pct })}
            </Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {formatCurrency(Number(order.platform_fee_value))}
            </Text>
          </View>
          {Number(order.cash_velocity_discount_pct) > 0 && (
            <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                {t('orderDetail.cashVelocityDiscount', { pct: order.cash_velocity_discount_pct })}
              </Text>
              <Text style={[styles.detailValue, { color: colors.safe }]}>
                -{formatCurrency(Number(order.gross_invoice_value) * Number(order.cash_velocity_discount_pct) / 100)}
              </Text>
            </View>
          )}
          <View style={[styles.detailRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>{t('orderDetail.netSellerPayout')}</Text>
            <Text style={[styles.totalValue, { color: colors.safe }]}>
              {formatCurrency(Number(order.net_seller_payout))}
            </Text>
          </View>
        </Card>

        <Card style={styles.batchCard}>
          <SectionHeader icon={AppIcons.batch} title={t('marketplace.batchNumber')} />
          <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orderDetail.declaredBatch')}</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {order.declared_batch_number || t('orderDetail.notAvailable')}
            </Text>
          </View>
          {order.scanned_batch_number && (
            <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orderDetail.scannedBatch')}</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: order.declared_batch_number !== order.scanned_batch_number ? colors.danger : colors.textPrimary },
                ]}
              >
                {order.scanned_batch_number}
              </Text>
            </View>
          )}
          <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orderDetail.paymentChannel')}</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {order.payment_channel?.replace(/_/g, ' ')}
            </Text>
          </View>
        </Card>

        {canScanBatch && (
          <Button
            title={t('orders.scanBatch')}
            onPress={() => navigation.navigate('BatchScan', { orderId: order.id, declaredBatchNumber: order.declared_batch_number || '' })}
            fullWidth
            size="lg"
            iconName={AppIcons.scan}
          />
        )}

        {state === 'DISPUTED' && (
          <Card
            style={[
              styles.disputeCard,
              { borderColor: colors.danger },
            ]}
          >
            <PharmaIcon name={AppIcons.alert} size={48} color={colors.danger} />
            <Text style={[styles.disputeTitle, { color: colors.danger }]}>
              {t('orders.status.DISPUTED')}
            </Text>
            <Text style={[styles.disputeText, { color: colors.textSecondary }]}>
              {t('admin.disputes')}
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  statusCard: { marginBottom: Spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusInfo: { flex: 1 },
  statusLabel: { ...Typography.h3 },
  statusDate: { ...Typography.caption },
  timelineCard: { marginBottom: Spacing.md },
  detailsCard: { marginBottom: Spacing.md },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  detailLabel: { ...Typography.bodySmall },
  detailValue: { ...Typography.bodySmall, fontWeight: '500' },
  totalRow: { borderBottomWidth: 0, paddingTop: Spacing.md },
  totalLabel: { ...Typography.h3 },
  totalValue: { ...Typography.price },
  batchCard: { marginBottom: Spacing.md },
  disputeCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
  disputeTitle: {
    ...Typography.h2,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  disputeText: {
    ...Typography.bodySmall,
    textAlign: 'center',
  },
});
