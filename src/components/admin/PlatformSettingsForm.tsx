import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { usePlatformSettings, useUpdatePlatformSettings } from '../../hooks/useDatabase';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card, SectionHeader } from '../ui/Card';
import { friendlyError } from '../../lib/utils';
import { useColors, Typography, Spacing } from '../../config/theme';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons } from '../ui/Icon';

export function PlatformSettingsForm() {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: settings, isLoading } = usePlatformSettings();
  const updateMutation = useUpdatePlatformSettings();

  const [feePercent, setFeePercent] = useState('');
  const [discountDefault, setDiscountDefault] = useState('');
  const [discountMin, setDiscountMin] = useState('');
  const [discountMax, setDiscountMax] = useState('');
  const [disputeThreshold, setDisputeThreshold] = useState('');

  useEffect(() => {
    if (settings) {
      setFeePercent(String(settings.global_fee_pct));
      setDiscountDefault(String(settings.cash_velocity_discount_default_pct));
      setDiscountMin(String(settings.cash_velocity_discount_min_pct));
      setDiscountMax(String(settings.cash_velocity_discount_max_pct));
      setDisputeThreshold(String(settings.dispute_auto_flag_threshold));
    }
  }, [settings]);

  const handleSave = () => {
    // Validate before mutate — NaN/blank fields previously became JSON null
    // → silent 400, and min>max corrupted the discount window (audit M18)
    const values = {
      global_fee_pct: parseFloat(feePercent),
      cash_velocity_discount_default_pct: parseFloat(discountDefault),
      cash_velocity_discount_min_pct: parseFloat(discountMin),
      cash_velocity_discount_max_pct: parseFloat(discountMax),
      dispute_auto_flag_threshold: parseInt(disputeThreshold, 10),
    };
    for (const [field, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) {
        Alert.alert(t('common.error'), `${field}: ${t('common.fillRequiredFields')}`);
        return;
      }
    }
    if (values.cash_velocity_discount_min_pct > values.cash_velocity_discount_max_pct) {
      Alert.alert(t('common.error'), 'Discount min cannot exceed discount max');
      return;
    }
    Alert.alert(
      'Update Settings',
      'This will change the platform fee for all future orders. In-flight orders retain their original fee rate.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            updateMutation.mutate(values, {
              onSuccess: () => Alert.alert(t('common.success'), t('common.done')),
              onError: (err) => Alert.alert(t('common.error'), friendlyError(err)),
            });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <Text style={[styles.loading, { color: colors.textTertiary }]}>
        {t('common.loading')}
      </Text>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <SectionHeader icon={AppIcons.admin} title={t('admin.settings')} />

      {/* Platform Fee */}
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('admin.feePercentage')}
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          Applied to every invoice's gross value at checkout
        </Text>
        <Input
          label="Platform Fee %"
          value={feePercent}
          onChangeText={setFeePercent}
          keyboardType="decimal-pad"
          placeholder="1.5"
          leftIcon="rupee"
        />
      </Card>

      {/* Cash-Velocity Discount */}
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('admin.cashVelocityDiscount')}
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          Discount for instant payment vs credit terms
        </Text>
        <Input
          label="Default Discount %"
          value={discountDefault}
          onChangeText={setDiscountDefault}
          keyboardType="decimal-pad"
          placeholder="3.0"
          leftIcon="receipt"
        />
        <Input
          label="Min Discount %"
          value={discountMin}
          onChangeText={setDiscountMin}
          keyboardType="decimal-pad"
          placeholder="2.0"
          leftIcon="receipt"
        />
        <Input
          label="Max Discount %"
          value={discountMax}
          onChangeText={setDiscountMax}
          keyboardType="decimal-pad"
          placeholder="6.0"
          leftIcon="receipt"
        />
      </Card>

      {/* Dispute Threshold */}
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Dispute Auto-Flag Threshold
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          Number of disputes within a rolling window before manual review
        </Text>
        <Input
          label="Threshold"
          value={disputeThreshold}
          onChangeText={setDisputeThreshold}
          keyboardType="number-pad"
          placeholder="3"
          leftIcon="alert"
        />
      </Card>

      <Button
        title={t('common.save')}
        onPress={handleSave}
        loading={updateMutation.isPending}
        fullWidth
        style={styles.saveButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  loading: {
    ...Typography.body,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  sectionHint: {
    ...Typography.bodySmall,
    marginBottom: Spacing.md,
  },
  saveButton: {
    marginBottom: Spacing.xxxl,
  },
});
