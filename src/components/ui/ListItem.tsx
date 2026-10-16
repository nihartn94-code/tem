import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, BorderRadius, Typography, Spacing } from '../../config/theme';
import { PharmaIcon, AppIcons } from '../ui/Icon';
import { formatCurrency } from '../../lib/utils';

// Marketplace listing item for Stockist browsing
interface MarketplaceItemProps {
  brandName: string;
  composition: string;
  price: number;
  stock: number;
  batchNumber: string;
  expiryDate: string;
  tradeScheme?: { buy: number; get_free: number } | null;
  companyName?: string;
  onAddToBasket: () => void;
}

export const MarketplaceItem = React.memo(function MarketplaceItem({
  brandName,
  composition,
  price,
  stock,
  batchNumber,
  expiryDate,
  tradeScheme,
  companyName,
  onAddToBasket,
}: MarketplaceItemProps) {
  const colors = useColors();
  const isExpiringSoon = new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <TouchableOpacity
      style={[
        styles.itemContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
      ]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${brandName}, ${composition}, ₹${price} per unit`}
    >
      {/* Header: Brand + Price */}
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={[styles.brandName, { color: colors.textPrimary }]} numberOfLines={1}>
            {brandName}
          </Text>
          <Text style={[styles.composition, { color: colors.textSecondary }]} numberOfLines={1}>
            {composition}
          </Text>
          {companyName && (
            <Text style={[styles.companyName, { color: colors.textTertiary }]}>by {companyName}</Text>
          )}
        </View>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: colors.safe }]}>{formatCurrency(price)}</Text>
          <Text style={[styles.perUnit, { color: colors.textTertiary }]}>/unit</Text>
        </View>
      </View>

      {/* Details row */}
      <View style={styles.detailsRow}>
        <View style={[styles.detailChip, { backgroundColor: colors.background }]}>
          <PharmaIcon name={AppIcons.basket} size={14} color={colors.textSecondary} />
          <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{stock} units</Text>
        </View>
        <View style={[styles.detailChip, { backgroundColor: colors.background }]}>
          <PharmaIcon name={AppIcons.batch} size={14} color={colors.textSecondary} />
          <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{batchNumber}</Text>
        </View>
        <View
          style={[
            styles.detailChip,
            { backgroundColor: colors.background },
            isExpiringSoon && { backgroundColor: colors.pendingSurface },
          ]}
        >
          <PharmaIcon
            name={AppIcons.pending}
            size={14}
            color={isExpiringSoon ? colors.pending : colors.textSecondary}
          />
          <Text
            style={[
              styles.detailValue,
              { color: colors.textSecondary },
              isExpiringSoon && { color: colors.pending },
            ]}
          >
            {expiryDate}
          </Text>
        </View>
      </View>

      {/* Trade scheme badge */}
      {tradeScheme && (
        <View style={[styles.schemeContainer, { backgroundColor: colors.primarySurface }]}>
          <PharmaIcon name={AppIcons.discount} size={14} color={colors.primary} />
          <Text style={[styles.schemeText, { color: colors.primary }]}>
            {' '}Buy {tradeScheme.buy} Get {tradeScheme.get_free} Free
          </Text>
        </View>
      )}

      {/* Add to basket button */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={onAddToBasket}
        accessibilityRole="button"
        accessibilityLabel={`Add ${brandName} to basket`}
      >
        <PharmaIcon name={AppIcons.add} size={20} color={colors.primaryText} />
        <Text style={[styles.addButtonText, { color: colors.primaryText }]}> Add to Basket</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// Order list item
interface OrderItemProps {
  orderNumber: string;
  state: string;
  quantity: number;
  amount: number;
  date: string;
  counterparty: string;
  onPress: () => void;
}

export const OrderItem = React.memo(function OrderItem({
  orderNumber,
  state,
  quantity,
  amount,
  date,
  counterparty,
  onPress,
}: OrderItemProps) {
  const colors = useColors();

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'DELIVERED_CONFIRMED':
      case 'SETTLED':
      case 'REFUNDED':
        return colors.safe;
      case 'DISPUTED':
        return colors.danger;
      default:
        return colors.pending;
    }
  };

  const getStatusBg = (s: string) => {
    switch (s) {
      case 'DELIVERED_CONFIRMED':
      case 'SETTLED':
      case 'REFUNDED':
        return colors.safeSurface;
      case 'DISPUTED':
        return colors.dangerSurface;
      default:
        return colors.pendingSurface;
    }
  };

  const getStatusIcon = (s: string): React.ComponentProps<typeof PharmaIcon>['name'] => {
    switch (s) {
      case 'SETTLED':
        return AppIcons.safe;
      case 'DISPUTED':
        return AppIcons.alert;
      case 'DELIVERED_CONFIRMED':
        return AppIcons.verified;
      default:
        return AppIcons.pending;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.orderContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Order ${orderNumber}, ${state}, ₹${amount}`}
    >
      <View style={styles.orderHeader}>
        <Text style={[styles.orderNumber, { color: colors.textPrimary }]}>#{orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(state) }]}>
          <PharmaIcon name={getStatusIcon(state)} size={12} color={getStatusColor(state)} />
          <Text style={[styles.statusText, { color: getStatusColor(state) }]}>
            {' '}{state.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.orderInfo}>
          <Text style={[styles.orderCounterparty, { color: colors.textPrimary }]}>{counterparty}</Text>
          <Text style={[styles.orderDate, { color: colors.textTertiary }]}>{date}</Text>
        </View>
        <View style={styles.orderAmount}>
          <Text style={[styles.orderAmountValue, { color: colors.textPrimary }]}>
            {formatCurrency(amount)}
          </Text>
          <Text style={[styles.orderQuantity, { color: colors.textTertiary }]}>{quantity} units</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  // Marketplace item
  itemContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  itemInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  brandName: {
    ...Typography.h3,
    marginBottom: 2,
  },
  composition: {
    ...Typography.bodySmall,
  },
  companyName: {
    ...Typography.caption,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    ...Typography.price,
  },
  perUnit: {
    ...Typography.caption,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  detailValue: {
    ...Typography.caption,
  },
  schemeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  schemeText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 44,
  },
  addButtonText: {
    ...Typography.button,
  },
  // Order item
  orderContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  orderNumber: {
    ...Typography.h3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  orderInfo: { flex: 1 },
  orderCounterparty: {
    ...Typography.body,
    fontWeight: '500',
  },
  orderDate: {
    ...Typography.caption,
    marginTop: 2,
  },
  orderAmount: {
    alignItems: 'flex-end',
  },
  orderAmountValue: {
    ...Typography.priceSmall,
  },
  orderQuantity: {
    ...Typography.caption,
    marginTop: 2,
  },
  // Entity item
  entityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  entityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  entityInfo: { flex: 1 },
  entityTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  entitySubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  entityRight: {
    marginLeft: Spacing.md,
  },
});
