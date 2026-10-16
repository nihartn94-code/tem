import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/ui/Header';
import { Card, SectionHeader, MetricCard } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useManufacturerCatalog, useActivePools, useCombinations, usePoolDispatch } from '../hooks/useDatabase';
import type { ManufacturerCatalog, ProductionPool, FormulationCombination } from '../lib/types';
import { useAuthContext } from '../config/providers';
import { useColors, Typography, Spacing, BorderRadius } from '../config/theme';
import { formatCurrency } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';
import { friendlyError } from '../lib/utils';

type ManufacturerView = 'list' | 'add';

export function ManufacturerScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuthContext();
  const { data: catalog, isLoading: catalogLoading, isError: catalogError, refetch } = useManufacturerCatalog(user?.id);
  const { data: pools, isLoading: poolsLoading, isError: poolsError } = useActivePools(user?.id);
  const dispatchMutation = usePoolDispatch();
  const [dispatchingPool, setDispatchingPool] = useState<string | null>(null);
  const { data: combinations } = useCombinations();
  const [view, setView] = useState<ManufacturerView>('list');

  const [selectedCombination, setSelectedCombination] = useState('');
  const [moq, setMoq] = useState('');
  const [factoryGateCost, setFactoryGateCost] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddListing = useCallback(async () => {
    if (!selectedCombination || !moq || !factoryGateCost || !leadTime) {
      Alert.alert(t('common.error'), t('common.fillRequiredFields'));
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('manufacturer_catalog').insert({
        manufacturer_id: user?.id,
        combination_id: selectedCombination,
        minimum_order_qty: parseInt(moq, 10),
        factory_gate_unit_cost: parseFloat(factoryGateCost),
        lead_time_days: parseInt(leadTime, 10),
        is_active: true,
      });
      if (error) throw error;
      Alert.alert(t('common.success'), t('manufacturer.catalogAdded'));
      setSelectedCombination('');
      setMoq('');
      setFactoryGateCost('');
      setLeadTime('');
      setView('list');
      refetch();
    } catch (err) {
      Alert.alert(t('common.error'), friendlyError(err, t('common.registrationFailed')));
    } finally {
      setSubmitting(false);
    }
  }, [selectedCombination, moq, factoryGateCost, leadTime, user?.id, refetch]);

  // §6.1 dispatch: ships the locked pool — creates MFG_TO_COMPANY orders via
  // the pool-dispatch Edge Function (server-derived economics, idempotent).
  const handleDispatch = useCallback((pool: ProductionPool) => {
    Alert.alert(
      t('manufacturer.dispatchPool'),
      t('manufacturer.dispatchConfirm', { batch: t('manufacturer.batchAssignedAtDispatch') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            setDispatchingPool(pool.id);
            // declared_batch_number is server-assigned (§3.7) — client never invents it
            dispatchMutation.mutate(
              { pool_id: pool.id },
              {
                onSuccess: (data) => {
                  setDispatchingPool(null);
                  Alert.alert(
                    t('common.success'),
                    t('manufacturer.dispatched', { count: data.created.length, skipped: data.skipped.length })
                  );
                },
                onError: (err) => {
                  setDispatchingPool(null);
                  Alert.alert(t('common.error'), friendlyError(err, t('common.error')));
                },
              }
            );
          },
        },
      ]
    );
  }, [dispatchMutation, t]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('manufacturer.myCatalog')}
        subtitle={`${catalog?.length || 0} product(s)`}
      />

      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <Button
            title={t('manufacturer.myCatalog')}
            onPress={() => setView('list')}
            variant={view === 'list' ? 'primary' : 'ghost'}
            size="sm"
            iconName={AppIcons.catalog}
            style={styles.tabButton}
          />
          <Button
            title={t('manufacturer.addListing')}
            onPress={() => setView('add')}
            variant={view === 'add' ? 'primary' : 'ghost'}
            size="sm"
            iconName={AppIcons.add}
            style={styles.tabButton}
          />
        </View>

        {/* Catalog View */}
        {view === 'list' && (
          <>
            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <MetricCard
                icon={AppIcons.catalog}
                value={catalog?.length || 0}
                label={t('manufacturer.myCatalog')}
                color={colors.roleManufacturer}
              />
              <MetricCard
                icon={AppIcons.refresh}
                value={pools?.length || 0}
                label={t('manufacturer.activePools')}
                color={colors.pending}
              />
            </View>

            {/* Active Pools */}
            <View style={styles.section}>
              <SectionHeader icon={AppIcons.refresh} title={t('manufacturer.activePools')} />
              {poolsLoading ? (
                <Text style={[styles.loading, { color: colors.textTertiary }]}>{t('common.loading')}</Text>
              ) : poolsError ? (
                <Card>
                  <EmptyState
                    icon="alert"
                    title={t('common.error')}
                    message={t('common.retry')}
                  />
                </Card>
              ) : !pools || pools.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={AppIcons.refresh}
                    title={t('manufacturer.noActivePools')}
                    message={t('manufacturer.noActivePoolsHint')}
                  />
                </Card>
              ) : (
                pools.map((pool: ProductionPool & { manufacturer_catalog?: { manufacturer_id: string } }) => (
                  <Card key={pool.id} style={styles.poolCard}>
                    <Text style={[styles.poolTitle, { color: colors.textPrimary }]}>
                      Pool #{pool.id.slice(0, 8)}
                    </Text>
                    <Text style={[styles.poolStatus, { color: colors.textSecondary }]}>
                      Status: {pool.status}
                    </Text>
                    <ProgressBar
                      current={pool.accumulated_quantity}
                      total={pool.target_quantity}
                      label={t('manufacturer.poolProgress')}
                      color={colors.pending}
                    />
                    {pool.status === 'locked' && (
                      <Button
                        title={t('manufacturer.dispatchPool')}
                        onPress={() => handleDispatch(pool)}
                        loading={dispatchingPool === pool.id}
                        disabled={dispatchMutation.isPending}
                        variant="secondary"
                        fullWidth
                        iconName={AppIcons.orders}
                        style={{ marginTop: Spacing.sm }}
                      />
                    )}
                  </Card>
                ))
              )}
            </View>

            {/* Production Catalog */}
            <View style={styles.section}>
              <SectionHeader icon={AppIcons.catalog} title={t('manufacturer.myCatalog')} />
              {catalogLoading ? (
                <Text style={[styles.loading, { color: colors.textTertiary }]}>{t('common.loading')}</Text>
              ) : catalogError ? (
                <Card>
                  <EmptyState
                    icon="alert"
                    title={t('common.error')}
                    message={t('common.retry')}
                  />
                </Card>
              ) : !catalog || catalog.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={AppIcons.catalog}
                    title={t('manufacturer.emptyCatalog')}
                    message={t('manufacturer.emptyCatalogHint')}
                    actionLabel={t('manufacturer.addListing')}
                    onAction={() => setView('add')}
                  />
                </Card>
              ) : (
                catalog.map((item: ManufacturerCatalog & { formulation_combinations?: FormulationCombination }) => (
                  <Card key={item.id} style={styles.catalogCard}>
                    <View style={styles.catalogRow}>
                      <View style={styles.catalogInfo}>
                        <Text style={[styles.catalogMolecule, { color: colors.textPrimary }]}>
                          {item.formulation_combinations?.display_composition || t('common.unknown')}
                        </Text>
                        <Text style={[styles.catalogDetails, { color: colors.textSecondary }]}>
                          MOQ: {item.minimum_order_qty} units • Lead: {item.lead_time_days}d
                        </Text>
                      </View>
                      <Text style={[styles.catalogPrice, { color: colors.safe }]}>
                        {formatCurrency(item.factory_gate_unit_cost)}
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </View>
          </>
        )}

        {/* Add Listing View */}
        {view === 'add' && (
          <Card style={styles.formCard}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
              {t('manufacturer.addListing')}
            </Text>
            <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
              {t('manufacturer.addListingSubtitle')}
            </Text>

            {/* Combination Selection */}
            <Text style={[styles.label, { color: colors.textPrimary }]}>Molecule/Combination *</Text>
            <View style={styles.combinationList}>
              {combinations?.map((combo) => (
                <Button
                  key={combo.id}
                  title={combo.display_composition}
                  onPress={() => setSelectedCombination(combo.id)}
                  variant={selectedCombination === combo.id ? 'primary' : 'ghost'}
                  size="sm"
                  style={styles.combinationChip}
                />
              ))}
            </View>

            <Input
              label="Minimum Order Quantity (units) *"
              value={moq}
              onChangeText={setMoq}
              placeholder="e.g. 1000"
              keyboardType="number-pad"
              leftIcon="catalog"
            />

            <Input
              label="Factory-Gate Unit Cost (₹) *"
              value={factoryGateCost}
              onChangeText={setFactoryGateCost}
              placeholder="e.g. 12.50"
              keyboardType="decimal-pad"
              leftIcon="rupee"
            />

            <Input
              label="Lead Time (days) *"
              value={leadTime}
              onChangeText={setLeadTime}
              placeholder="e.g. 14"
              keyboardType="number-pad"
              leftIcon="pending"
            />

            <Button
              title={t('manufacturer.addToCatalog')}
              onPress={handleAddListing}
              loading={submitting}
              fullWidth
              size="lg"
            />
          </Card>
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  section: { marginBottom: Spacing.xl },
  loading: {
    ...Typography.body,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  poolCard: { marginBottom: Spacing.md },
  poolTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  poolStatus: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  catalogCard: { marginBottom: Spacing.md },
  catalogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catalogInfo: { flex: 1 },
  catalogMolecule: {
    ...Typography.body,
    fontWeight: '600',
  },
  catalogDetails: {
    ...Typography.caption,
    marginTop: 2,
  },
  catalogPrice: {
    ...Typography.priceSmall,
  },
  formCard: { padding: Spacing.xl },
  formTitle: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
  },
  formSubtitle: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  combinationList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  combinationChip: { marginBottom: Spacing.xs },
});
