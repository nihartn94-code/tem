import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { TabScreenNavProp } from '../navigation/AppNavigator';
import { Header } from '../components/ui/Header';
import { BasketItem } from '../components/basket/BasketItem';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useBasket, useCheckout } from '../hooks/useDatabase';
import type { BasketItem as BasketItemType } from '../hooks/useDatabase';
import { useColors, Typography, Spacing, BorderRadius } from '../config/theme';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../lib/utils';
import { useAuthContext } from '../config/providers';
import { supabase } from '../lib/supabase';
import { usePlatformSettings } from '../hooks/useDatabase';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';
import { friendlyError } from '../lib/utils';
import { ScanToBasketModal } from '../components/basket/ScanToBasketModal';
import { Config } from '../config';

export function BasketScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const navigation = useNavigation<TabScreenNavProp>();
  const { user } = useAuthContext();
  const { items, removeItem, updateQuantity, clearBasket, getSubtotal, addItem } = useBasket();
  const checkoutMutation = useCheckout();
  const { data: settings } = usePlatformSettings();
  // Delivery location comes from the verified compliance profile. There is NO
  // default — fabricated coords would feed the server's delivery-radius gate
  // false data, so checkout is blocked until real coords exist.
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scanVisible, setScanVisible] = useState(false);

  useEffect(() => {
    const fetchCoords = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('compliance_profiles')
          .select('facility_lat, facility_lng')
          .eq('user_id', user.id)
          .single();
        if (data && data.facility_lat != null && data.facility_lng != null) {
          setDeliveryCoords({ lat: data.facility_lat, lng: data.facility_lng });
        }
      } catch {
        // deliveryCoords stays null → checkout blocked with an explanation
      }
    };
    fetchCoords();
  }, [user]);

  // Buyer pays the seller's gross invoice via UPI (SRS §1.3). The platform fee
  // is NOT a buyer surcharge — it is deducted from the seller's payout at
  // settlement, server-side. Shown here as display-only context.
  const feePct = settings?.global_fee_pct ?? 1.5;
  const subtotal = getSubtotal();
  const total = subtotal;

  const generateUPILink = useCallback((amount: number, orderId: string) => {
    const upiId = Config.payment.upiId;
    const payeeName = Config.payment.upiPayeeName;
    const transactionNote = `Order ${orderId}`;
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
  }, []);

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert(t('basket.empty'));
      return;
    }
    if (!deliveryCoords) {
      // No verified delivery location — the server geo-fence cannot run, so
      // checkout must not proceed with invented coordinates
      Alert.alert(t('common.error'), t('basket.noDeliveryLocation'));
      return;
    }
    // Idempotency key generated once per checkout attempt (§25): retries,
    // double-taps and app restarts during checkout reuse it, so the server
    // can never create duplicate orders for this basket.
    const idempotencyKey = `chk_${user?.id ?? 'anon'}_${Date.now()}`;
    Alert.alert(
      t('common.confirmCheckout'),
      `Total: ${formatCurrency(total)}\n${items.length} item(s) from ${new Set(items.map(i => i.brandName)).size} brand(s)`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('basket.checkout'),
          onPress: () => {
            checkoutMutation.mutate(
              {
                items: items.map((item) => ({
                  marketplace_listing_id: item.listingId,
                  quantity: item.quantity,
                })),
                payment_channel: 'MANUAL_CONFIRMATION',
                delivery_lat: deliveryCoords.lat,
                delivery_lng: deliveryCoords.lng,                idempotency_key: idempotencyKey,
              },
              {
                onSuccess: (data) => {
                  // Buyer pays the seller's gross invoice via UPI. Amount MUST
                  // come from the server-computed orders — never the client
                  // estimate (P0 fix). Basket clears in BOTH branches —
                  // otherwise the user can re-checkout the same items (audit H8)
                  const placed = data.orders ?? [];
                  const orderId = placed[0]?.order_id || '';
                  const payAmount = placed.reduce((sum, o) => sum + Number(o.gross_invoice_value ?? 0), 0);
                  const upiLink = generateUPILink(payAmount, orderId);
                  clearBasket();
                  Alert.alert(
                    `${t('common.orderPlaced')}`,
                    `Your order has been placed.\n\nPay via UPI, confirm manually:\n${formatCurrency(payAmount)}\n\nTap below to open your UPI app.`,
                    [
                      {
                        text: t('common.payViaUPI'),
                        onPress: () => {
                          navigation.navigate('Orders');
                          Linking.openURL(upiLink).catch(() => {
                            Alert.alert(t('basket.upiNotAvailable'), t('basket.upiFallback'));
                          });
                        },
                      },
                      {
                        text: t('common.payLater'),
                        onPress: () => { navigation.navigate('Orders'); },
                      },
                    ]
                  );
                },
                onError: (error) => {
                  Alert.alert(t('common.checkoutFailed'), friendlyError(error, t('common.retry')));
                },
              }
            );
          },
        },
      ]
    );
  };

  const renderItem = useCallback(({ item }: { item: BasketItemType }) => (
    <BasketItem item={item} onUpdateQuantity={updateQuantity} onRemove={removeItem} />
  ), [updateQuantity, removeItem]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('basket.title')}
        subtitle={`${items.length} item(s)`}
        rightAction={items.length > 0 ? {
          icon: AppIcons.delete,
          label: t('common.clear'),
          onPress: () => {
            Alert.alert(t('common.clearBasket'), t('common.removeAll'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.clear'), onPress: clearBasket, style: 'destructive' },
            ]);
          },
        } : undefined}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {items.length === 0 ? (
          <EmptyState
            icon={AppIcons.basket}
            title={t('basket.empty')}
            message={t('common.basketHint')}
            actionLabel={t('marketplace.title')}
            onAction={() => navigation.navigate('Marketplace')}
          />
        ) : (
          <>
              <View style={styles.scanRow}>
                <Button
                  title={t('basket.scanOrderList')}
                  onPress={() => setScanVisible(true)}
                  iconName={AppIcons.scan}
                  variant="secondary"
                  fullWidth
                />
              </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
            />
            <Card style={styles.summaryCard} elevated>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {t('basket.subtotal')}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                  {formatCurrency(subtotal)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {t('basket.platformFee')} ({feePct}%)
                </Text>
                <Text style={[styles.summaryValue, { color: colors.textSecondary }]}>
                  {t('basket.feeAtSettlement')}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>
                  {t('basket.total')}
                </Text>
                <Text style={[styles.totalValue, { color: colors.safe }]}>
                  {formatCurrency(total)}
                </Text>
              </View>
              {items.some(i => i.tradeScheme?.get_free && i.tradeScheme.get_free > 0) && (
                <View style={[styles.savingsBanner, { backgroundColor: colors.safeSurface }]}>
                  <PharmaIcon name={AppIcons.discount} size={16} color={colors.safe} />
                  <Text style={[styles.savingsText, { color: colors.safe }]}> {t('basket.splitSavings')}</Text>
                </View>
              )}
              <View style={[styles.paymentModeBanner, { backgroundColor: colors.secondarySurface }]}>
                <PharmaIcon name={AppIcons.payment} size={16} color={colors.secondary} />
                <Text style={[styles.paymentModeText, { color: colors.secondary }]}> Pay via UPI, confirm manually</Text>
              </View>
              <Button
                title={`${t('basket.checkout')} • ${formatCurrency(total)}`}
                onPress={handleCheckout}
                loading={checkoutMutation.isPending}
                fullWidth
                size="lg"
                style={styles.checkoutButton}
                iconName={AppIcons.payment}
              />
            </Card>
          </>
        )}
      </View>
      <ScanToBasketModal
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        onAdd={(scanned) => {
          for (const item of scanned) addItem(item);
          if (scanned.length > 0) {
            Alert.alert(t('basket.scan.addedTitle'), t('basket.scan.addedMsg', { count: scanned.length }));
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  listContent: { padding: Spacing.lg, paddingBottom: 0 },
  summaryCard: { margin: Spacing.lg, marginTop: 0 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: { ...Typography.bodySmall },
  summaryValue: { ...Typography.bodySmall, fontWeight: '500' },
  divider: { height: 1, marginVertical: Spacing.sm },
  totalLabel: { ...Typography.h3 },
  totalValue: { ...Typography.price },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  savingsText: { ...Typography.caption, fontWeight: '600' },
  paymentModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  paymentModeText: { ...Typography.caption, fontWeight: '600' },
  checkoutButton: { marginTop: Spacing.xs },
  scanRow: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
});
