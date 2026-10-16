import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { useColors, BorderRadius, Typography, Spacing, useShadows } from '../../config/theme';
import { PharmaIcon, AppIcons, type IconName } from './Icon';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  elevated?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'none';
}

export function Card({ children, onPress, style, elevated = true, accessibilityLabel, accessibilityRole }: CardProps) {
  const colors = useColors();
  const shadows = useShadows();
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
        elevated && shadows.md,
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole || (onPress ? 'button' : 'none')}
    >
      {children}
    </Container>
  );
}

// Status Badge — three-color system per SRS §5
interface StatusBadgeProps {
  status: 'safe' | 'pending' | 'danger';
  label: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const colors = useColors();

  const colorMap = {
    safe: { bg: colors.safeSurface, text: colors.safeText },
    pending: { bg: colors.pendingSurface, text: colors.pendingText },
    danger: { bg: colors.dangerSurface, text: colors.dangerText },
  };

  const badgeColors = colorMap[status];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeColors.bg,
          paddingHorizontal: size === 'sm' ? Spacing.sm : Spacing.md,
          paddingVertical: size === 'sm' ? 2 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: badgeColors.text, fontSize: size === 'sm' ? 10 : 12 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// Icon + Number card — SRS §5: "Icon + number, not paragraphs"
interface MetricCardProps {
  icon: IconName;
  value: string | number;
  label: string;
  color?: string;
  onPress?: () => void;
}

export function MetricCard({ icon, value, label, color, onPress }: MetricCardProps) {
  const colors = useColors();
  const iconColor = color || colors.primary;

  return (
    <Card onPress={onPress} style={styles.metricCard}>
      <PharmaIcon name={icon} size={28} color={iconColor} />
      <Text style={[styles.metricValue, { color: iconColor }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Card>
  );
}

// Section header with optional action — used across dashboard screens
interface SectionHeaderProps {
  icon?: React.ComponentProps<typeof PharmaIcon>['name'];
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ icon, title, action, onAction }: SectionHeaderProps) {
  const colors = useColors();

  return (
    <View style={styles.sectionHeader}>
      {icon && <PharmaIcon name={icon} size={20} color={colors.primary} />}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={[styles.sectionAction, { color: colors.textLink }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  badge: {
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: '600',
  },
  metricCard: {
    alignItems: 'center',
    padding: Spacing.lg,
    minWidth: 100,
  },
  metricValue: {
    ...Typography.price,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  metricLabel: {
    ...Typography.caption,
    textAlign: 'center',
  },
  priceCard: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  price: {
    ...Typography.price,
  },
  priceLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  schemeBadge: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  schemeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  sectionAction: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
});
