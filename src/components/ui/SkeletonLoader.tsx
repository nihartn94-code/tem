import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useColors, BorderRadius, Spacing } from '../../config/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

/**
 * Single skeleton block with shimmer animation.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = BorderRadius.sm, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const colors = useColors();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton card — mimics a Card layout with placeholder lines.
 */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const colors = useColors();

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.surface }]}>
      <Skeleton width="40%" height={20} style={{ marginBottom: Spacing.sm }} />
      <Skeleton width="70%" height={14} style={{ marginBottom: Spacing.sm }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '50%' : '90%'}
          height={14}
          style={{ marginBottom: Spacing.sm }}
        />
      ))}
    </View>
  );
}

/**
 * Skeleton list — multiple card placeholders.
 */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={listStyles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

/**
 * Skeleton marketplace item — mimics the MarketplaceItem layout.
 */
export function SkeletonMarketplaceItem() {
  const colors = useColors();

  return (
    <View style={[marketStyles.container, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <View style={marketStyles.header}>
        <View style={{ flex: 1, marginRight: Spacing.md }}>
          <Skeleton width="60%" height={18} style={{ marginBottom: Spacing.xs }} />
          <Skeleton width="80%" height={12} />
        </View>
        <Skeleton width={70} height={28} />
      </View>
      <View style={marketStyles.chips}>
        <Skeleton width={80} height={24} borderRadius={12} />
        <Skeleton width={90} height={24} borderRadius={12} />
        <Skeleton width={100} height={24} borderRadius={12} />
      </View>
      <Skeleton width="100%" height={44} borderRadius={BorderRadius.md} />
    </View>
  );
}

/**
 * Skeleton order item — mimics the OrderItem layout.
 */
export function SkeletonOrderItem() {
  const colors = useColors();

  return (
    <View style={[orderStyles.container, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <View style={orderStyles.row}>
        <Skeleton width="30%" height={18} />
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>
      <Skeleton width="50%" height={14} style={{ marginTop: Spacing.sm }} />
      <View style={[orderStyles.row, { marginTop: Spacing.sm }]}>
        <Skeleton width="20%" height={20} />
        <Skeleton width="25%" height={14} />
      </View>
    </View>
  );
}

/**
 * Full-screen loading state — replaces blank white flash.
 */
export function ScreenLoader({ message }: { message?: string }) {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const dotScale = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 1, 0.4],
  });

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[screenStyles.dot, { opacity: dotScale, backgroundColor: colors.primary }]} />
      {message && (
        <Animated.Text style={[screenStyles.message, { opacity: dotScale, color: colors.textSecondary }]}>
          {message}
        </Animated.Text>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
});

const listStyles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
});

const marketStyles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
});

const orderStyles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
  },
});
