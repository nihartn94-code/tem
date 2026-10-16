import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useColors, Typography, Spacing, BorderRadius } from '../../config/theme';
import { PharmaIcon, type IconName } from './Icon';
import { useTranslation } from 'react-i18next';

interface SafeScreenProps {
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: IconName;
  emptyAction?: () => void;
  emptyActionLabel?: string;
}

export function SafeScreen({
  children,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyTitle,
  emptyMessage = '',
  emptyIcon = 'info' as IconName,
  emptyAction,
  emptyActionLabel,
}: SafeScreenProps) {
  const colors = useColors();
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <PharmaIcon name="alert" size={48} color={colors.danger} />
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>{t('common.error')}</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>{error}</Text>
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <PharmaIcon name="refresh" size={18} color={colors.primaryText} />
            <Text style={[styles.retryText, { color: colors.primaryText }]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <PharmaIcon name={emptyIcon} size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{emptyTitle ?? t('common.nothingHere')}</Text>
        {emptyMessage ? (
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{emptyMessage}</Text>
        ) : null}
        {emptyAction && emptyActionLabel && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={emptyAction}
            accessibilityRole="button"
            accessibilityLabel={emptyActionLabel}
          >
            <Text style={[styles.retryText, { color: colors.primaryText }]}>{emptyActionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  errorTitle: {
    ...Typography.h3,
    marginTop: Spacing.md,
  },
  errorMessage: {
    ...Typography.body,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.md,
  },
  emptyMessage: {
    ...Typography.body,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  retryText: {
    ...Typography.body,
    fontWeight: '600',
  },
});
