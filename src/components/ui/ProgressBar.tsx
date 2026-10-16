import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, BorderRadius, Typography, Spacing } from '../../config/theme';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  color?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ current, total, label, color, showPercentage = true }: ProgressBarProps) {
  const colors = useColors();
  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const percentage = Math.round(progress * 100);
  const barColor = color || colors.primary;

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          {showPercentage && (
            <Text style={[styles.percentage, { color: colors.textPrimary }]}>{percentage}%</Text>
          )}
        </View>
      )}
      <View style={[styles.track, { backgroundColor: colors.borderLight }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.current, { color: colors.textPrimary }]}>{current}</Text>
        <Text style={[styles.total, { color: colors.textTertiary }]}>/ {total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.caption,
  },
  percentage: {
    ...Typography.caption,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
  },
  current: {
    ...Typography.bodySmall,
    fontWeight: '700',
  },
  total: {
    ...Typography.caption,
    marginLeft: 2,
  },
});
