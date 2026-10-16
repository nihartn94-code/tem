import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, Typography, Spacing, useShadows, Shadows } from '../../config/theme';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons, type IconName } from './Icon';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: {
    icon: IconName;
    label: string;
    onPress: () => void;
  };
  showRoleBadge?: boolean;
  role?: string;
  isOffline?: boolean;
}

export function Header({
  title,
  subtitle,
  rightAction,
  showRoleBadge,
  role,
  isOffline,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const shadows = useShadows();
  const { t } = useTranslation();

  const roleColors: Record<string, string> = {
    ADMIN: colors.roleAdmin,
    MANUFACTURER: colors.roleManufacturer,
    PHARMA_COMPANY: colors.roleCompany,
    STOCKIST: colors.roleStockist,
  };

  const roleLabels: Record<string, string> = {
    ADMIN: t('auth.admin'),
    MANUFACTURER: t('auth.manufacturer'),
    PHARMA_COMPANY: t('auth.company'),
    STOCKIST: t('auth.stockist'),
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
          paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + Spacing.sm,
        },
        shadows.sm,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.primaryText }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.primaryText, opacity: 0.8 }]}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          {showRoleBadge && role && (
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: roleColors[role] || colors.primary },
              ]}
            >
              <Text style={[styles.roleBadgeText, { color: colors.primaryText }]}>
                {roleLabels[role] || role}
              </Text>
            </View>
          )}

          {isOffline && (
            <View
              style={[
                styles.offlineBadge,
                { backgroundColor: colors.pendingSurface },
              ]}
            >
              <PharmaIcon name={AppIcons.wifiOff} size={14} color={colors.pending} />
              <Text style={[styles.offlineText, { color: colors.pending }]}>
                {' '}{t('common.offline')}
              </Text>
            </View>
          )}

          {rightAction && (
            <TouchableOpacity
              onPress={rightAction.onPress}
              style={[
                styles.actionButton,
                { backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
              accessibilityRole="button"
              accessibilityLabel={rightAction.label}
            >
              <PharmaIcon name={rightAction.icon} size={22} color={colors.primaryText} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Shadows.sm,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    ...Typography.h1,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgeText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  offlineText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
