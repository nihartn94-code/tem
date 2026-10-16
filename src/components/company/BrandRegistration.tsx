import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRegisterBrand } from '../../hooks/useDatabase';
import { BrandRegistrationSchema, type BrandRegistrationInput } from '../../lib/validation';
import { Input, CameraInput } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useColors, Typography, Spacing } from '../../config/theme';
import { useTranslation } from 'react-i18next';
import { captureAndUpload } from '../../lib/documents';
import { friendlyError } from '../../lib/utils';

interface BrandRegistrationProps {
  companyId: string;
  combinations: { id: string; display_composition: string }[];
  onSuccess?: () => void;
}

export function BrandRegistration({ companyId, combinations, onSuccess }: BrandRegistrationProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const registerMutation = useRegisterBrand();
  const [uploading, setUploading] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<BrandRegistrationInput>({
    resolver: zodResolver(BrandRegistrationSchema),
  });

  const onSubmit = async (data: BrandRegistrationInput) => {
    try {
      await registerMutation.mutateAsync({
        company_id: companyId,
        ...data,
      });
      Alert.alert(t('common.success'), t('company.brandRegistered'));
      reset();
      onSuccess?.();
    } catch (err) {
      Alert.alert(t('common.error'), friendlyError(err, t('common.registrationFailed')));
    }
  };

  // Real capture → upload → form value (anti-dummy-brand gate, §7).
  // The storage path lands in company_brands.trademark_doc_storage_path.
  const handleTrademarkCapture = async (onChange: (value: string) => void) => {
    try {
      setUploading(true);
      const path = await captureAndUpload(companyId, 'trademark');
      if (path) {
        onChange(path);
        Alert.alert(t('common.success'), t('company.trademarkUploaded'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), friendlyError(err, t('onboarding.uploadFailed')));
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('company.registerBrand')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Register a branded formulation against a molecule combination
        </Text>

        {/* Brand Name */}
        <Controller
          control={control}
          name="brand_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('company.brandName')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.brand_name?.message}
              required
              placeholder="e.g. GlucoMet 500"
            />
          )}
        />

        {/* Combination Selection */}
        <Controller
          control={control}
          name="combination_id"
          render={({ field: { onChange, value } }) => (
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('company.combination')} *
              </Text>
              <View style={styles.combinationList}>
                {combinations.map((combo) => (
                  <Button
                    key={combo.id}
                    title={combo.display_composition}
                    onPress={() => onChange(combo.id)}
                    variant={value === combo.id ? 'primary' : 'ghost'}
                    size="sm"
                    style={styles.combinationChip}
                  />
                ))}
              </View>
              {errors.combination_id && (
                <Text style={[styles.error, { color: colors.danger }]}>
                  {errors.combination_id.message}
                </Text>
              )}
            </View>
          )}
        />

        {/* Trademark Document — Camera-first per SRS §5, real upload */}
        <Controller
          control={control}
          name="trademark_doc_storage_path"
          render={({ field: { onChange, value } }) => (
            <CameraInput
              label={t('company.trademarkDoc')}
              value={value || ''}
              onCapture={() => handleTrademarkCapture(onChange)}
              placeholder={t('company.trademarkPlaceholder')}
              error={errors.trademark_doc_storage_path?.message}
            />
          )}
        />

        <Button
          title={uploading ? t('common.loading') : t('onboarding.submitForVerification')}
          onPress={handleSubmit(onSubmit)}
          loading={registerMutation.isPending || uploading}
          disabled={uploading}
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
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xl,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodySmall,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  combinationList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  combinationChip: {
    marginBottom: Spacing.xs,
  },
  error: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
});
