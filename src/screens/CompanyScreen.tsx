import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/ui/Header';
import { Card, SectionHeader, StatusBadge } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { BrandRegistration } from '../components/company/BrandRegistration';
import { MarketplaceListingForm } from '../components/company/MarketplaceListingForm';
import { useCompanyBrands, useCombinations } from '../hooks/useDatabase';
import type { CompanyBrand, FormulationCombination } from '../lib/types';
import { useAuthContext } from '../config/providers';
import { useColors, Typography, Spacing } from '../config/theme';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';

type CompanyView = 'brands' | 'register' | 'list';

export function CompanyScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuthContext();
  const { data: brands, isLoading } = useCompanyBrands(user?.id);
  const { data: combinations } = useCombinations();
  const [view, setView] = useState<CompanyView>('brands');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('company.myBrands')}
        subtitle={`${brands?.length || 0} brand(s)`}
      />

      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <Button
            title={t('company.myBrands')}
            onPress={() => setView('brands')}
            variant={view === 'brands' ? 'primary' : 'ghost'}
            size="sm"
            iconName={AppIcons.brands}
            style={styles.tabButton}
          />
          <Button
            title={t('company.registerBrand')}
            onPress={() => setView('register')}
            variant={view === 'register' ? 'primary' : 'ghost'}
            size="sm"
            iconName={AppIcons.add}
            style={styles.tabButton}
          />
        </View>

        {/* Brands List */}
        {view === 'brands' && (
          <>
            {isLoading ? (
              <Text style={[styles.loading, { color: colors.textTertiary }]}>{t('common.loading')}</Text>
            ) : !brands || brands.length === 0 ? (
              <EmptyState
                icon={AppIcons.brands}
                title={t('company.myBrands')}
                message={t('company.registerFirstBrand')}
                actionLabel={t('company.registerBrand')}
                onAction={() => setView('register')}
              />
            ) : (
              brands.map((brand: CompanyBrand & { formulation_combinations?: FormulationCombination }) => (
                <Card key={brand.id} style={styles.brandCard}>
                  <View style={styles.brandRow}>
                    <View style={styles.brandInfo}>
                      <Text style={[styles.brandName, { color: colors.textPrimary }]}>
                        {brand.brand_name}
                      </Text>
                      <Text style={[styles.brandComposition, { color: colors.textSecondary }]}>
                        {brand.formulation_combinations?.display_composition || ''}
                      </Text>
                    </View>
                    <StatusBadge
                      status={brand.is_verified_trademark ? 'safe' : 'pending'}
                      label={brand.is_verified_trademark ? t('common.verified') : t('common.pending')}
                      size="sm"
                    />
                  </View>
                  <Button
                    title={t('company.listForSale')}
                    onPress={() => {
                      setSelectedBrandId(brand.id);
                      setView('list');
                    }}
                    variant="secondary"
                    size="sm"
                    style={styles.listButton}
                  />
                </Card>
              ))
            )}
          </>
        )}

        {/* Register Brand */}
        {view === 'register' && (
          <BrandRegistration
            companyId={user?.id || ''}
            combinations={combinations || []}
            onSuccess={() => setView('brands')}
          />
        )}

        {/* List for Sale */}
        {view === 'list' && selectedBrandId && (
          <MarketplaceListingForm
            brandId={selectedBrandId}
            onSuccess={() => setView('brands')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  tabBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tabButton: { flex: 1 },
  loading: {
    ...Typography.body,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  brandCard: { marginBottom: Spacing.md },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  brandInfo: { flex: 1 },
  brandName: {
    ...Typography.h3,
    marginBottom: 2,
  },
  brandComposition: {
    ...Typography.bodySmall,
  },
  listButton: { marginTop: Spacing.xs },
});
