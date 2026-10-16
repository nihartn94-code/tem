import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useColors, BorderRadius, Typography, Spacing } from '../../config/theme';
import { Button } from '../ui/Button';
import { useResolveDispute } from '../../hooks/useDatabase';
import { formatCurrency, formatDate, friendlyError } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { PharmaIcon } from '../ui/Icon';

interface DisputeCardProps {
  dispute: {
    id: string;
    order_id: string;
    reason: string;
    resolution: string;
    created_at: string;
    raiser?: { display_name: string };
    order?: {
      quantity: number;
      gross_invoice_value: number;
      declared_batch_number: string;
      scanned_batch_number: string;
    };
  };
}

import { AppIcons, type IconName } from '../ui/Icon';

// Values are AppIcons KEYS, resolved to real MaterialCommunityIcons names —
// raw key strings rendered as icon names produced blank icons (audit M12)
const REASON_ICONS: Record<string, IconName> = {
  BATCH_MISMATCH: AppIcons.batch as IconName,
  LATE_DELIVERY: AppIcons.orders as IconName,
  QUALITY_ISSUE: AppIcons.alert as IconName,
  QUANTITY_MISMATCH: AppIcons.packageCheck as IconName,
  OTHER: AppIcons.info as IconName,
};

export function DisputeCard({ dispute }: DisputeCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const resolveMutation = useResolveDispute();

  const handleResolve = (resolution: 'RELEASED_TO_SELLER' | 'REFUNDED_TO_BUYER') => {
    const label = resolution === 'RELEASED_TO_SELLER'
      ? t('admin.releaseToSeller')
      : t('admin.refundToBuyer');

    Alert.alert(
      t('admin.resolve'),
      `${label}? This action cannot be undone.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            // Irreversible release/refund — silent success/failure is unacceptable
            resolveMutation.mutate(
              {
                dispute_ticket_id: dispute.id,
                resolution,
              },
              {
                onSuccess: () => Alert.alert(t('admin.resolve'), t('admin.disputeResolved')),
                onError: (err) => Alert.alert(t('common.error'), friendlyError(err)),
              },
            );
          },
        },
      ]
    );
  };

  const reasonLabels: Record<string, string> = {
    BATCH_MISMATCH: 'Batch Mismatch',
    LATE_DELIVERY: 'Late Delivery',
    QUALITY_ISSUE: 'Quality Issue',
    QUANTITY_MISMATCH: 'Quantity Mismatch',
    OTHER: 'Other',
  };

  const isPending = dispute.resolution === 'PENDING';
  const iconName = REASON_ICONS[dispute.reason] ?? AppIcons.alert;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isPending ? colors.danger : colors.borderLight,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PharmaIcon name={iconName} size={24} color={colors.danger} style={styles.reasonIcon} />
          <View>
            <Text style={[styles.reasonText, { color: colors.textPrimary }]}>
              {reasonLabels[dispute.reason] || dispute.reason}
            </Text>
            <Text style={[styles.date, { color: colors.textTertiary }]}>
              {formatDate(dispute.created_at)}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.resolutionBadge,
            { backgroundColor: isPending ? colors.pendingSurface : colors.safeSurface },
          ]}
        >
          <Text
            style={[
              styles.resolutionText,
              { color: isPending ? colors.pending : colors.safe },
            ]}
          >
            {isPending ? 'Pending' : 'Resolved'}
          </Text>
        </View>
      </View>

      {/* Evidence */}
      {dispute.order && (
        <View style={[styles.evidence, { backgroundColor: colors.background }]}>
          <Text style={[styles.evidenceTitle, { color: colors.textSecondary }]}>Evidence</Text>
          <View style={styles.evidenceRow}>
            <Text style={[styles.evidenceLabel, { color: colors.textSecondary }]}>Declared:</Text>
            <Text style={[styles.evidenceValue, { color: colors.textPrimary }]}>
              {dispute.order.declared_batch_number}
            </Text>
          </View>
          <View style={styles.evidenceRow}>
            <Text style={[styles.evidenceLabel, { color: colors.textSecondary }]}>Scanned:</Text>
            <Text style={[styles.evidenceValue, { color: colors.danger }]}>
              {dispute.order.scanned_batch_number}
            </Text>
          </View>
          <View style={styles.evidenceRow}>
            <Text style={[styles.evidenceLabel, { color: colors.textSecondary }]}>Amount:</Text>
            <Text style={[styles.evidenceValue, { color: colors.textPrimary }]}>
              {formatCurrency(Number(dispute.order.gross_invoice_value))}
            </Text>
          </View>
          <View style={styles.evidenceRow}>
            <Text style={[styles.evidenceLabel, { color: colors.textSecondary }]}>Raised by:</Text>
            <Text style={[styles.evidenceValue, { color: colors.textPrimary }]}>
              {dispute.raiser?.display_name}
            </Text>
          </View>
        </View>
      )}

      {/* One-click resolution actions */}
      {isPending && (
        <View style={styles.actions}>
          <Button
            title={t('admin.refundToBuyer')}
            onPress={() => handleResolve('REFUNDED_TO_BUYER')}
            variant="danger"
            size="sm"
            loading={resolveMutation.isPending}
            style={styles.actionButton}
          />
          <Button
            title={t('admin.releaseToSeller')}
            onPress={() => handleResolve('RELEASED_TO_SELLER')}
            variant="safe"
            size="sm"
            loading={resolveMutation.isPending}
            style={styles.actionButton}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reasonIcon: {
    marginRight: Spacing.md,
  },
  reasonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  date: {
    ...Typography.caption,
    marginTop: 2,
  },
  resolutionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  resolutionText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  evidence: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  evidenceTitle: {
    ...Typography.caption,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  evidenceRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  evidenceLabel: {
    ...Typography.bodySmall,
    width: 80,
  },
  evidenceValue: {
    ...Typography.bodySmall,
    fontWeight: '500',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
