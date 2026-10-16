import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '../components/ui/Header';
import { Input, CameraInput } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useColors, Typography, Spacing } from '../config/theme';
import { DrugLicenseSchema, type DrugLicenseInput } from '../lib/validation';
import { callEdgeFunction, supabase } from '../lib/supabase';
import { useAuthContext } from '../config/providers';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';
import { friendlyError } from '../lib/utils';
import { useOCR } from '../hooks/useOCR';

type OnboardingStep = 'entity' | 'license' | 'location' | 'submit';

export function OnboardingScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuthContext();

  const [step, setStep] = useState<OnboardingStep>('entity');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check for existing compliance profile on mount
  useEffect(() => {
    const checkCompliance = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('compliance_profiles')
          .select('verification_status')
          .eq('user_id', user.id)
          .single();

        if (data?.verification_status === 'verified') {
          navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
          return;
        }
      } catch {
        // No profile exists — continue to onboarding
      } finally {
        setChecking(false);
      }
    };
    checkCompliance();
  }, [user?.id, navigation]);

  const {
    control, handleSubmit, setValue, trigger, formState: { errors },
  } = useForm<DrugLicenseInput>({
    resolver: zodResolver(DrugLicenseSchema),
    defaultValues: { who_gmp_certified: false, facility_lat: 0, facility_lng: 0 },
  });

  // F1 — OCR-assisted license capture: photograph the license, extract the
  // license number + expiry via on-device ML Kit, PRE-FILL the fields for the
  // user to confirm/correct. Never auto-accepts (SRS §3.1 confirm-not-auto-accept).
  const [ocrBusy, setOcrBusy] = useState(false);
  const ocr = useOCR();
  const handleOcrLicense = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.camera'), t('onboarding.cameraRequired'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (result.canceled || !result.assets[0]) return;
      setOcrBusy(true);
      const ocrResults = await ocr.processImage(result.assets[0].uri);
      const fullText = ocrResults.map((r) => r.text).join(' ');
      // License number: "Form 20"/"Form 21" numbers or DL-/20B/21B patterns
      const licMatch = fullText.match(/(?:DL|Form\s*2[01]|Lic(?:ense|ence)\s*No\.?|2[01][BA])[:\s-]*([A-Z0-9\/-]{4,25})/i);
      // Expiry: dd/mm/yyyy, dd-mm-yyyy or yyyy-mm-dd
      const expMatch = fullText.match(/(\d{4}-\d{2}-\d{2})|(\d{2}[\/-]\d{2}[\/-]\d{4})/);
      let found = false;
      if (licMatch) {
        setValue('drug_license_number', licMatch[1].trim(), { shouldValidate: true });
        found = true;
      }
      if (expMatch) {
        let iso = expMatch[0];
        if (expMatch[2]) {
          const [, d, m, y] = expMatch[2].match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/)!;
          iso = `${y}-${m}-${d}`;
        }
        setValue('drug_license_expiry', iso, { shouldValidate: true });
        found = true;
      }
      Alert.alert(
        t('onboarding.ocrTitle'),
        found ? t('onboarding.ocrPrefilled') : t('onboarding.ocrNotFound'),
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert(t('common.error'), t('onboarding.ocrFailed'));
    } finally {
      setOcrBusy(false);
    }
  };

  const completedSteps = step === 'entity' ? 0 : step === 'license' ? 1 : step === 'location' ? 2 : 3;

  const onSubmit = async (data: DrugLicenseInput) => {
    setLoading(true);
    try {
      await callEdgeFunction('onboard-compliance', data);
      Alert.alert(t('onboarding.pendingVerification'), t('onboarding.pendingVerificationMsg'), [
        { text: t('common.ok'), onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] }) },
      ]);
    } catch (err) {
      Alert.alert(t('common.error'), friendlyError(err, t('common.error')));
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = async (field: string, onChange: (value: string) => void) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.camera'), t('onboarding.cameraRequired'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const fileName = `${field}_${Date.now()}.jpg`;
        const filePath = `documents/${user?.id}/${fileName}`;

        const response = await fetch(uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('compliance-docs')
          .upload(filePath, blob, { contentType: 'image/jpeg' });

        if (uploadError) {
          Alert.alert(t('common.error'), t('onboarding.uploadFailed'));
          return;
        }

        onChange(filePath);
      }
    } catch (err) {
      Alert.alert(t('common.error'), t('onboarding.ocrFailed'));
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]}>
        <Header title={t('onboarding.title')} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]}>
      <Header title={t('onboarding.title')} subtitle={t('onboarding.stepOf', { step: completedSteps + 1 })} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ProgressBar current={completedSteps} total={3} label={t("onboarding.title") + " " + t("common.progress")} />

          {step === 'entity' && (
            <Card style={styles.card}>
              <PharmaIcon name={AppIcons.company} size={48} color={colors.primary} />
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                {t('onboarding.title')}
              </Text>
              <Controller control={control} name="legal_entity_name" render={({ field: { onChange, onBlur, value } }) => (
                <Input label={t('onboarding.legalEntityName')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.legal_entity_name?.message} required placeholder="e.g. ABC Pharma Pvt Ltd" />
              )} />
              <Controller control={control} name="gstin" render={({ field: { onChange, onBlur, value } }) => (
                <Input label={t('onboarding.gstin')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.gstin?.message} required placeholder="22AAAAA0000A1Z5" />
              )} />
              <Button title={t('auth.continue')} onPress={async () => {
                const okStep = await trigger(['legal_entity_name', 'gstin']);
                if (okStep) setStep('license');
              }} fullWidth size="lg" />
            </Card>
          )}

          {step === 'license' && (
            <Card style={styles.card}>
              <PharmaIcon name={AppIcons.orders} size={48} color={colors.primary} />
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                {t('onboarding.drugLicenseNumber')}
              </Text>
              <Controller control={control} name="drug_license_number" render={({ field: { onChange, onBlur, value } }) => (
                <Input label={t('onboarding.drugLicenseNumber')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.drug_license_number?.message} required placeholder="Form 20/21 Number" />
              )} />
              <Controller control={control} name="drug_license_expiry" render={({ field: { onChange, onBlur, value } }) => (
                <Input label={t('onboarding.drugLicenseExpiry')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.drug_license_expiry?.message} required placeholder="YYYY-MM-DD" />
              )} />
              <Controller control={control} name="license_doc_storage_path" render={({ field: { onChange, value } }) => (
                <CameraInput label={t('onboarding.uploadLicense')} value={value || ''} onCapture={() => handleCameraCapture('license_doc', onChange)} placeholder="Photograph your Drug License" error={errors.license_doc_storage_path?.message} />
              )} />
              <Button
                title={ocrBusy ? t('common.loading') : t('onboarding.scanLicense')}
                onPress={handleOcrLicense}
                variant="secondary"
                fullWidth
                iconName={AppIcons.scan}
                disabled={ocrBusy}
                loading={ocrBusy}
              />
              <View style={styles.buttonRow}>
                <Button title={t('common.back')} onPress={() => setStep('entity')} variant="ghost" style={{ flex: 1 }} />
                <Button title={t('auth.continue')} onPress={async () => {
                  const okStep = await trigger(['drug_license_number', 'drug_license_expiry']);
                  if (okStep) setStep('location');
                }} fullWidth style={{ flex: 2 }} size="lg" />
              </View>
            </Card>
          )}

          {step === 'location' && (
            <Card style={styles.card}>
              <PharmaIcon name={AppIcons.info} size={48} color={colors.primary} />
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                {t('onboarding.facilityLocation')}
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {t('onboarding.facilityLocation')}
              </Text>
              <Controller control={control} name="facility_lat" render={({ field: { onChange, onBlur, value } }) => (
                <Input label={t('onboarding.latitude')} value={String(value)} onChangeText={(v) => onChange(parseFloat(v) || 0)} onBlur={onBlur} keyboardType="decimal-pad" placeholder="28.6139" />
              )} />
              <Controller control={control} name="facility_lng" render={({ field: { onChange, onBlur, value } }) => (
                <Input label={t('onboarding.longitude')} value={String(value)} onChangeText={(v) => onChange(parseFloat(v) || 0)} onBlur={onBlur} keyboardType="decimal-pad" placeholder="77.2090" />
              )} />
              <Controller control={control} name="who_gmp_certified" render={({ field: { onChange, value } }) => (
                <Button title={value ? t('onboarding.gmpYes') : t('onboarding.gmpAsk')} onPress={() => onChange(!value)} variant={value ? 'safe' : 'ghost'} fullWidth iconName={value ? AppIcons.verified : AppIcons.catalog} />
              )} />
              <Controller control={control} name="gmp_cert_storage_path" render={({ field: { onChange, value } }) => (
                <CameraInput label={t('onboarding.uploadGMP')} value={value || ''} onCapture={() => handleCameraCapture('gmp_cert', onChange)} placeholder="Photograph GMP certificate (optional)" />
              )} />
              <View style={styles.buttonRow}>
                <Button title={t('common.back')} onPress={() => setStep('license')} variant="ghost" style={{ flex: 1 }} />
                <Button title={t('onboarding.submitForVerification')} onPress={handleSubmit(onSubmit)} loading={loading} fullWidth style={{ flex: 2 }} size="lg" />
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...Typography.body },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  card: { padding: Spacing.xl, marginTop: Spacing.lg },
  stepTitle: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  hint: {
    ...Typography.bodySmall,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
});
