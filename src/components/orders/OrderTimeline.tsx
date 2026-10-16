import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, BorderRadius, Typography, Spacing } from '../../config/theme';
import type { OrderState } from '../../lib/types';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons, type IconName } from '../ui/Icon';

interface TimelineStep {
  state: string;
  label: string;
  icon: IconName;
}

const ORDER_STATES: TimelineStep[] = [
  { state: 'POOLING_ACTIVE', label: 'Pooling', icon: AppIcons.pending },
  { state: 'BATCH_LOCKED', label: 'Batch Locked', icon: AppIcons.escrow },
  { state: 'IN_PRODUCTION', label: 'In Production', icon: AppIcons.catalog },
  { state: 'DISPATCHED', label: 'Dispatched', icon: AppIcons.truck },
  { state: 'DELIVERED_PENDING_SCAN', label: 'Awaiting Scan', icon: AppIcons.scan },
  { state: 'DELIVERED_CONFIRMED', label: 'Delivered', icon: AppIcons.verified },
  { state: 'SETTLED', label: 'Settled', icon: AppIcons.safe },
];

interface OrderTimelineProps {
  currentState: OrderState;
}

export function OrderTimeline({ currentState }: OrderTimelineProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const isDisputed = currentState === 'DISPUTED';
  const isRefunded = currentState === 'REFUNDED';

  const currentIndex = ORDER_STATES.findIndex((s) => s.state === currentState);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Order Progress</Text>

      {isDisputed && (
        <View
          style={[
            styles.disputedBanner,
            { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
          ]}
        >
          <PharmaIcon name={AppIcons.alert} size={24} color={colors.danger} />
          <View style={styles.bannerInfo}>
            <Text style={[styles.disputedTitle, { color: colors.danger }]}>Under Dispute</Text>
            <Text style={[styles.disputedText, { color: colors.textSecondary }]}>
              Payment held pending Admin review
            </Text>
          </View>
        </View>
      )}

      {isRefunded && (
        <View
          style={[
            styles.refundedBanner,
            { backgroundColor: colors.safeSurface, borderColor: colors.safe },
          ]}
        >
          <PharmaIcon name={AppIcons.escrow} size={24} color={colors.safe} />
          <View style={styles.bannerInfo}>
            <Text style={[styles.refundedTitle, { color: colors.safe }]}>Refunded</Text>
            <Text style={[styles.refundedText, { color: colors.textSecondary }]}>
              Funds returned to buyer
            </Text>
          </View>
        </View>
      )}

      <View style={styles.timeline}>
        {ORDER_STATES.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isFuture = index > currentIndex;

          return (
            <View key={step.state} style={styles.stepContainer}>
              {index > 0 && (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: colors.border },
                    isCompleted && { backgroundColor: colors.safe },
                    isActive && { backgroundColor: colors.pending },
                  ]}
                />
              )}

              <View style={styles.stepRow}>
                <View
                  style={[
                    styles.stepIndicator,
                    { backgroundColor: colors.background },
                    isCompleted && { backgroundColor: colors.safe },
                    isActive && { backgroundColor: colors.pending },
                    isFuture && { backgroundColor: colors.background },
                  ]}
                >
                  {isCompleted ? (
                    <PharmaIcon name={AppIcons.check} size={12} color={colors.primaryText} />
                  ) : (
                    <PharmaIcon
                      name={step.icon}
                      size={14}
                      color={isFuture ? colors.textTertiary : colors.primaryText}
                    />
                  )}
                </View>

                <View style={styles.stepContent}>
                  <Text
                    style={[
                      styles.stepLabel,
                      { color: colors.textTertiary },
                      isCompleted && { color: colors.safe, fontWeight: '600' },
                      isActive && { color: colors.pending, fontWeight: '700' },
                      isFuture && { color: colors.textTertiary },
                    ]}
                  >
                    {t(`orders.status.${step.state}`)}
                  </Text>
                  {isActive && (
                    <View style={styles.activeIndicator}>
                      <Text style={[styles.activeText, { color: colors.pending }]}>● Current</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
  },
  disputedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  refundedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  bannerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  disputedTitle: {
    ...Typography.body,
    fontWeight: '700',
  },
  disputedText: {
    ...Typography.caption,
    marginTop: 2,
  },
  refundedTitle: {
    ...Typography.body,
    fontWeight: '700',
  },
  refundedText: {
    ...Typography.caption,
    marginTop: 2,
  },
  timeline: {
    paddingLeft: Spacing.sm,
  },
  stepContainer: {
    marginBottom: Spacing.sm,
  },
  connector: {
    width: 2,
    height: 20,
    marginLeft: 13,
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    ...Typography.bodySmall,
  },
  activeIndicator: {
    marginTop: 2,
  },
  activeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
