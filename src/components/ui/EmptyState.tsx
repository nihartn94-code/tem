import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, Typography, Spacing } from '../../config/theme';
import { Button } from './Button';
import { PharmaIcon, AppIcons, type IconName } from './Icon';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty state with retry action — SRS §5: every screen needs
 * proper empty states (not a blank list with nothing explaining why).
 */
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PharmaIcon name={icon} size={64} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {message && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          style={styles.action}
        />
      )}
    </View>
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
  action: {
    minWidth: 200,
  },
});
