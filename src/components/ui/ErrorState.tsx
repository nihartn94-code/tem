import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, Typography, Spacing, BorderRadius } from '../../config/theme';
import { Button } from './Button';
import { PharmaIcon, AppIcons } from './Icon';
import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  icon?: React.ComponentProps<typeof PharmaIcon>['name'];
  style?: object;
}

/**
 * Error state with retry action — SRS §5: every screen needs
 * proper error states with a real recovery action (retry button),
 * not just red text.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  icon = AppIcons.alert,
  style,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.dangerSurface }]}>
        <PharmaIcon name={icon} size={56} color={colors.danger} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {title || t('common.error')}
      </Text>
      {message && (
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      )}
      {onRetry && (
        <Button
          title={t('common.retry')}
          onPress={onRetry}
          variant="primary"
          size="md"
          icon={<PharmaIcon name={AppIcons.retry} size={18} color={colors.primaryText} />}
          style={styles.retryButton}
        />
      )}
    </View>
  );
}

/**
 * Inline error banner — for use inside cards or lists.
 */
export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View
      style={[
        styles.inlineContainer,
        {
          backgroundColor: colors.dangerSurface,
          borderColor: colors.danger,
        },
      ]}
    >
      <PharmaIcon name={AppIcons.warning} size={18} color={colors.danger} />
      <Text style={[styles.inlineMessage, { color: colors.danger }]}>{message}</Text>
      {onRetry && (
        <Button title={t('common.retry')} onPress={onRetry} variant="danger" size="sm" />
      )}
    </View>
  );
}

/**
 * Network error state — for offline detection.
 */
export function OfflineError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <ErrorState
      icon={AppIcons.wifiOff}
      title={t('common.offline')}
      message={t('errors.network')}
      onRetry={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.xxxl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  retryButton: {
    minWidth: 160,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  inlineMessage: {
    ...Typography.bodySmall,
    flex: 1,
  },
});
