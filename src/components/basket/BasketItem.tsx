import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, BorderRadius, Typography, Spacing } from '../../config/theme';
import type { BasketItem as BasketItemType } from '../../hooks/useDatabase';
import { PharmaIcon, AppIcons } from '../ui/Icon';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface BasketItemProps {
  item: BasketItemType;
  onUpdateQuantity: (listingId: string, quantity: number) => void;
  onRemove: (listingId: string) => void;
}

export function BasketItem({ item, onUpdateQuantity, onRemove }: BasketItemProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const lineTotal = item.pricePerUnit * item.quantity;

  // Calculate trade scheme benefit
  let schemeSavings = 0;
  if (item.tradeScheme && item.tradeScheme.get_free > 0) {
    const fullSets = Math.floor(item.quantity / item.tradeScheme.buy);
    schemeSavings = fullSets * item.tradeScheme.get_free * item.pricePerUnit;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
      ]}
    >
      {/* Item info */}
      <View style={styles.info}>
        <Text style={[styles.brandName, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.brandName}
        </Text>
        <Text style={[styles.composition, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.composition}
        </Text>
        <Text style={[styles.price, { color: colors.safe }]}>
          ₹{item.pricePerUnit} /unit
        </Text>
      </View>

      {/* Quantity controls — 44x44pt minimum touch targets */}
      <View style={styles.quantitySection}>
        <View style={[styles.quantityControls, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[
              styles.quantityButton,
              { backgroundColor: colors.surface },
              item.quantity <= 1 && styles.quantityButtonDisabled,
            ]}
            onPress={() => {
              if (item.quantity <= 1) {
                onRemove(item.listingId);
              } else {
                onUpdateQuantity(item.listingId, item.quantity - 1);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={item.quantity <= 1 ? 'Remove item' : 'Decrease quantity'}
          >
            <PharmaIcon
              name={item.quantity <= 1 ? AppIcons.delete : AppIcons.remove}
              size={20}
              color={item.quantity <= 1 ? colors.danger : colors.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.quantityValue, { color: colors.textPrimary }]}>{item.quantity}</Text>
          <TouchableOpacity
            style={[
              styles.quantityButton,
              { backgroundColor: colors.surface },
              item.quantity >= item.availableStock && styles.quantityButtonDisabled,
            ]}
            onPress={() => onUpdateQuantity(item.listingId, item.quantity + 1)}
            disabled={item.quantity >= item.availableStock}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
          >
            <PharmaIcon name={AppIcons.add} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.lineTotal, { color: colors.textPrimary }]}>
          {formatCurrency(lineTotal)}
        </Text>
      </View>

      {/* Trade scheme badge */}
      {schemeSavings > 0 && (
        <View style={[styles.schemeBadge, { backgroundColor: colors.safeSurface }]}>
          <PharmaIcon name={AppIcons.discount} size={14} color={colors.safe} />
          <Text style={[styles.schemeText, { color: colors.safe }]}>
            {' '}{t('basket.schemeSavings', { amount: formatCurrency(schemeSavings) })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  info: {
    marginBottom: Spacing.md,
  },
  brandName: {
    ...Typography.h3,
    marginBottom: 2,
  },
  composition: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xs,
  },
  price: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    ...Typography.priceSmall,
    paddingHorizontal: Spacing.lg,
    minWidth: 50,
    textAlign: 'center',
  },
  lineTotal: {
    ...Typography.priceSmall,
  },
  schemeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  schemeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
