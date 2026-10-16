import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useBroadcastNotifications } from '../../hooks/useBroadcastNotifications';
import { useAuthContext } from '../../config/providers';
import { useColors, Typography, Spacing, BorderRadius } from '../../config/theme';
import { PharmaIcon, AppIcons } from './Icon';

/**
 * Global broadcast notification banner.
 * Subscribes to Supabase Realtime for BROADCAST_SENT events
 * and displays a dismissable banner when a new broadcast arrives.
 * Only shows broadcasts targeted at the user's role (or ALL).
 */
export function BroadcastBanner() {
  const { user } = useAuthContext();
  const colors = useColors();
  const { latestBroadcast, dismissBroadcast } = useBroadcastNotifications(user?.role);

  if (!latestBroadcast) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.secondarySurface,
          borderBottomColor: colors.secondary,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
        <PharmaIcon name={AppIcons.broadcast} size={20} color={colors.primaryText} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.secondary }]}>Platform Broadcast</Text>
        <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={3}>
          {latestBroadcast.message}
        </Text>
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          {new Date(latestBroadcast.sent_at).toLocaleTimeString()}
        </Text>
      </View>
      <Pressable
        onPress={dismissBroadcast}
        style={styles.dismissButton}
        accessibilityRole="button"
        accessibilityLabel="Dismiss broadcast"
      >
        <PharmaIcon name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dismissButton: {
    padding: Spacing.xs,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.caption,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    ...Typography.bodySmall,
    marginBottom: 4,
  },
  meta: {
    ...Typography.caption,
  },
});
