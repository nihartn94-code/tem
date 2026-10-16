import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { TabScreenNavProp } from '../navigation/AppNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/ui/Header';
import { SearchBar } from '../components/search/SearchBar';
import { MarketplaceItem } from '../components/ui/ListItem';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { SkeletonMarketplaceItem } from '../components/ui/SkeletonLoader';
import { StatusBadge } from '../components/ui/Card';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';
import { useMarketplaceListings, useBasket } from '../hooks/useDatabase';
import type { StockistMarketplace } from '../lib/types';
import { useColors, Typography, Spacing } from '../config/theme';
import { useTranslation } from 'react-i18next';

export function MarketplaceScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<TabScreenNavProp>();
  const colors = useColors();
  const { addItem, getItemCount } = useBasket();
  const [selectedCombination, setSelectedCombination] = useState<string | undefined>();
  const { data: listings, isLoading, isError, error, refetch } = useMarketplaceListings(selectedCombination);

  const handleResultSelect = useCallback((combinationId: string) => {
    setSelectedCombination(combinationId);
  }, []);

  type MarketplaceListing = StockistMarketplace & {
    company_brands: {
      brand_name: string;
      combination_id: string;
      formulation_combinations: { display_composition: string };
    };
  };

  const handleAddToBasket = useCallback((item: MarketplaceListing) => {
    addItem({
      listingId: item.id,
      brandName: item.company_brands?.brand_name || t('common.unknown'),
      composition: item.company_brands?.formulation_combinations?.display_composition || '',
      pricePerUnit: item.wholesale_price_per_unit,
      quantity: 1,
      availableStock: item.available_stock_units,
      tradeScheme: item.trade_scheme,
    });
  }, [addItem]);

  const renderItem = useCallback(({ item }: { item: MarketplaceListing }) => (
    <MarketplaceItem
      brandName={item.company_brands?.brand_name || t('common.unknownBrand')}
      composition={item.company_brands?.formulation_combinations?.display_composition || ''}
      price={item.wholesale_price_per_unit}
      stock={item.available_stock_units}
      batchNumber={item.batch_number}
      expiryDate={item.expiry_date}
      tradeScheme={item.trade_scheme}
      onAddToBasket={() => handleAddToBasket(item)}
    />
  ), [handleAddToBasket]);

  const renderSkeleton = useCallback(() => (
    <View style={styles.listContent}>
      <SkeletonMarketplaceItem />
      <SkeletonMarketplaceItem />
      <SkeletonMarketplaceItem />
      <SkeletonMarketplaceItem />
    </View>
  ), []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('marketplace.title')}
        subtitle={t('search.cheapestFirst')}
        rightAction={{
          icon: AppIcons.basket,
          label: `${getItemCount()}`,
          onPress: () => navigation.navigate('Basket'),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search */}
        <View style={styles.searchWrapper}>
          <SearchBar onResultSelect={handleResultSelect} />
        </View>

        {/* Active Filter */}
        {selectedCombination && (
          <View style={styles.filterRow}>
            <StatusBadge status="safe" label={t('marketplace.filteredByMolecule')} size="sm" />
            <Text
              style={[styles.clearFilter, { color: colors.textLink }]}
              onPress={() => setSelectedCombination(undefined)}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
            >
              {t('common.clear')} ✕
            </Text>
          </View>
        )}

        {/* Loading State */}
        {isLoading && renderSkeleton()}

        {/* Error State */}
        {isError && (
          <ErrorState
            title={t('common.error')}
            message={error?.message || t('errors.network')}
            onRetry={refetch}
          />
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!listings || listings.length === 0) && (
          <EmptyState
            icon={AppIcons.marketplace}
            title={t('marketplace.title')}
            message={t('marketplace.noListings')}
          />
        )}

        {/* Listings */}
        {!isLoading && !isError && listings && listings.length > 0 && (
          <FlatList
            data={listings}
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
  searchWrapper: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  clearFilter: {
    ...Typography.caption,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
});
