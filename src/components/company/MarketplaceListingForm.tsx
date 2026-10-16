import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Input, CameraInput } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useColors, Typography, Spacing } from '../../config/theme';
import { supabase } from '../../lib/supabase';
import { useOCR } from '../../hooks/useOCR';
import { useAuthContext } from '../../config/providers';
import { useTranslation } from 'react-i18next';
import { MarketplaceListingSchema } from '../../lib/validation';
import { friendlyError } from '../../lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface MarketplaceListingFormProps {
  brandId: string;
  onSuccess?: () => void;
}

export function MarketplaceListingForm({ brandId, onSuccess }: MarketplaceListingFormProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const { ensurePermission, scanBatchNumber } = useOCR();
  const [loading, setLoading] = useState(false);

  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [schemeBuy, setSchemeBuy] = useState('');
  const [schemeGetFree, setSchemeGetFree] = useState('');

  // Real camera scan → OCR → batch number prefill (user-editable, never
  // auto-committed — audit H6 closed: the form was previously a stub alert)
  const handleBatchScan = async () => {
    const hasPermission = await ensurePermission();
    if (!hasPermission) return;
    Alert.alert(
      t('common.camera'),
      t('batchscan.cameraHint'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('batchscan.openCamera'),
          onPress: async () => {
            try {
              const result = await require('expo-image-picker').launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.9,
              });
              if (result.canceled || !result.assets[0]) return;
              const scanned = await scanBatchNumber(result.assets[0].uri);
              if (scanned) {
                setBatchNumber(scanned);
              } else {
                Alert.alert(t('batchscan.notDetected'), t('batchscan.notDetectedMsg'));
              }
            } catch (err) {
              Alert.alert(t('common.error'), friendlyError(err, t('common.retry')));
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert(t('common.error'), t('marketplace.loginRequired'));
      return;
    }

    // Validate against the shared schema (server parity) — previously this
    // form could never be submitted (audit H6)
    const parsed = MarketplaceListingSchema.safeParse({
      brand_id: brandId,
      company_id: user.id,
      batch_number: batchNumber.trim(),
      expiry_date: expiryDate.trim(),
      wholesale_price_per_unit: parseFloat(price),
      available_stock_units: parseInt(stock, 10),
      trade_scheme:
        schemeBuy && parseInt(schemeBuy, 10) > 0
          ? { buy: parseInt(schemeBuy, 10), get_free: parseInt(schemeGetFree, 10) || 0 }
          : null,
    });
    if (!parsed.success) {
      Alert.alert(t('common.error'), parsed.error.issues[0]?.message || t('common.fillRequiredFields'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('stockist_marketplace').insert(parsed.data);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      Alert.alert(t('common.success'), t('marketplace.listed'));
      setBatchNumber('');
      setExpiryDate('');
      setPrice('');
      setStock('');
      setSchemeBuy('');
      setSchemeGetFree('');
      onSuccess?.();
    } catch (err) {
      Alert.alert(t('common.error'), friendlyError(err, t('marketplace.listingFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('company.listForSale')}
        </Text>

        {/* Batch Number — Camera-first with typing fallback */}
        <CameraInput
          label={t('marketplace.batchNumber')}
          value={batchNumber}
          onCapture={handleBatchScan}
          onTextChange={setBatchNumber}
          placeholder={t('batchscan.enterBatchNumber')}
        />

        {/* Expiry Date */}
        <Input
          label={t('marketplace.expiry')}
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="YYYY-MM-DD"
          leftIcon="pending"
          keyboardType="numbers-and-punctuation"
        />

        {/* Price */}
        <Input
          label={`${t('company.pricing')} (₹/unit)`}
          value={price}
          onChangeText={setPrice}
          placeholder="0.00"
          leftIcon="rupee"
          keyboardType="decimal-pad"
        />

        {/* Stock */}
        <Input
          label={`${t('company.stock')} (units)`}
          value={stock}
          onChangeText={setStock}
          placeholder="0"
          leftIcon="catalog"
          keyboardType="number-pad"
        />

        {/* Trade Scheme — SRS §3.4: structured data, not free text */}
        <View style={styles.schemeRow}>
          <View style={styles.schemeInput}>
            <Input
              label="Buy Qty"
              value={schemeBuy}
              onChangeText={setSchemeBuy}
              placeholder="10"
              keyboardType="number-pad"
            />
          </View>
          <Text style={[styles.schemePlus, { color: colors.textTertiary }]}>+</Text>
          <View style={styles.schemeInput}>
            <Input
              label="Get Free"
              value={schemeGetFree}
              onChangeText={setSchemeGetFree}
              placeholder="1"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Button
          title={t('company.listForSale')}
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  card: {
    padding: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xl,
  },
  schemeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  schemeInput: {
    flex: 1,
  },
  schemePlus: {
    ...Typography.h2,
    marginTop: Spacing.xl,
  },
});
