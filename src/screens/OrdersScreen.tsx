import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../components/ui/Header';
import { supabase } from '../lib/supabase';
import { OrderItem } from '../components/ui/ListItem';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { SkeletonOrderItem } from '../components/ui/SkeletonLoader';
import { useMyOrders, useBasket } from '../hooks/useDatabase';
import type { Order } from '../lib/types';
import { useAuthContext } from '../config/providers';
import { useColors, Typography, Spacing, BorderRadius } from '../config/theme';
import { formatDate, formatCurrency } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type OrdersNavProp = NativeStackNavigationProp<RootStackParamList>;

export function OrdersScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuthContext();
  const navigation = useNavigation<OrdersNavProp>();
  const { data: orders, isLoading, isError, error, refetch } = useMyOrders(user?.id);
  const { addItem, getItemCount } = useBasket();

  type OrderWithRelations = Order & {
    buyer?: { display_name: string; role: string };
    seller?: { display_name: string; role: string };
  };

  const handleReorder = useCallback((order: OrderWithRelations) => {
    Alert.alert(
      t('common.reorder'),
      `Reorder ${order.quantity} units of this item?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.addToBasket'),
          onPress: async () => {
            // Reorder requires the original listing to still exist —
            // fabricating an id would poison checkout (audit H4). Stock comes
            // from the live listing — never invented client-side.
            if (!order.marketplace_listing_id) {
              Alert.alert(t('common.error'), t('orders.reorderUnavailable'));
              return;
            }
            const { data: listing } = await supabase
              .from('stockist_marketplace')
              .select('available_stock_units, wholesale_price_per_unit')
              .eq('id', order.marketplace_listing_id)
              .maybeSingle();
            if (!listing || listing.available_stock_units <= 0) {
              Alert.alert(t('common.error'), t('orders.reorderUnavailable'));
              return;
            }
            addItem({
              listingId: order.marketplace_listing_id,
              brandName: order.seller?.display_name || t('common.previousOrder'),
              composition: '',
              pricePerUnit: Number(listing.wholesale_price_per_unit),
              quantity: order.quantity,
              availableStock: listing.available_stock_units,
              tradeScheme: null,
            });
            Alert.alert('Added to Basket', 'Items added. Go to basket to checkout.');
          },
        },
      ]
    );
  }, [addItem, t]);

  const renderItem = useCallback(({ item }: { item: OrderWithRelations }) => (
    <View>
      <OrderItem
        orderNumber={item.id.slice(0, 8)}
        state={item.state}
        quantity={item.quantity}
        amount={Number(item.gross_invoice_value)}
        date={formatDate(item.created_at)}
        counterparty={item.seller?.display_name || item.buyer?.display_name || t('common.unknown')}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      />
      {item.marketplace_listing_id && (item.state === 'SETTLED' || item.state === 'DELIVERED_CONFIRMED') && user?.role === 'STOCKIST' && (
        <TouchableOpacity
          style={[styles.reorderButton, { backgroundColor: colors.secondarySurface }]}
          onPress={() => handleReorder(item)}
          accessibilityRole="button"
          accessibilityLabel={t('orders.reorder')}
        >
          <PharmaIcon name={AppIcons.refresh} size={16} color={colors.secondary} />
          <Text style={[styles.reorderText, { color: colors.secondary }]}> {t('orders.reorder')}</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [navigation, handleReorder, user?.role, colors, t]);

  const renderSkeleton = useCallback(() => (
    <View style={styles.listContent}>
      <SkeletonOrderItem />
      <SkeletonOrderItem />
      <SkeletonOrderItem />
      <SkeletonOrderItem />
    </View>
  ), []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('orders.title')}
        subtitle={`${orders?.length || 0} order(s)`}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {isLoading && renderSkeleton()}

        {isError && (
          <ErrorState
            title={t('common.error')}
            message={error?.message || t('errors.network')}
            onRetry={refetch}
          />
        )}

        {!isLoading && !isError && (!orders || orders.length === 0) && (
          <EmptyState
            icon={AppIcons.orders}
            title={t('orders.noOrders')}
            message={t('orders.noOrdersHint')}
          />
        )}

        {!isLoading && !isError && orders && orders.length > 0 && (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={refetch} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  listContent: {
    padding: Spacing.lg,
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 6,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  reorderText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
});
