import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Card';
import { ScreenLoader } from '../components/ui/SkeletonLoader';
import { ErrorState } from '../components/ui/ErrorState';
import { useOCR } from '../hooks/useOCR';
import { callEdgeFunction } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useColors, Typography, Spacing, BorderRadius } from '../config/theme';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';
import { friendlyError } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'BatchScan'>;

export function BatchScanScreen({ route, navigation }: Props) {
  const orderId = route.params?.orderId || '';
  const declaredBatchNumber = route.params?.declaredBatchNumber || '';
  const { t } = useTranslation();
  const colors = useColors();
  const { ensurePermission, isProcessing, scanBatchNumber } = useOCR();
  const queryClient = useQueryClient();
  const [scannedBatch, setScannedBatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBatchInput, setManualBatchInput] = useState('');
  const [result, setResult] = useState<{ state: string; dispute_ticket_id: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
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
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.9,
                base64: false,
              });

              if (!result.canceled && result.assets[0]) {
                setError(null);
                const batchNumber = await scanBatchNumber(result.assets[0].uri);
                if (batchNumber) {
                  setScannedBatch(batchNumber);
                } else {
                  Alert.alert(
                    t('batchscan.notDetected'),
                    t('batchscan.notDetectedMsg'),
                    [
                      { text: t('common.retry'), onPress: () => handleScan() },
                      {
                        text: t('batchscan.enterManually'),
                        onPress: () => setShowManualInput(true),
                      },
                    ]
                  );
                }
              }
            } catch (err) {
              setError(friendlyError(err, t('common.retry')));
            } finally {
            }
          },
        },
      ]
    );
  }, [ensurePermission, scanBatchNumber, t]);

  const handleConfirm = useCallback(async () => {
    if (!scannedBatch) return;
    setLoading(true);
    setError(null);
    try {
      const response = await callEdgeFunction<{ state: string; dispute_ticket_id: string | null }>(
        'confirm-batch-delivery',
        { order_id: orderId, scanned_batch_number: scannedBatch }
      );
      setResult(response);
      // Order state changed server-side — invalidate order caches so the
      // detail/orders screens never show a stale state (audit M9)
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    } catch (err) {
      setError(friendlyError(err, t('common.confirmationFailed')));
    } finally {
      setLoading(false);
    }
  }, [scannedBatch, orderId]);

  const isMatch = scannedBatch === declaredBatchNumber;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('orders.scanBatch')}
        subtitle="SRS §3.7 Batch Verification Gate"
        rightAction={{ icon: AppIcons.back, label: t('common.back'), onPress: () => navigation.goBack() }}
      />
      <View style={[styles.container, { backgroundColor: colors.background, padding: Spacing.lg }]}>
        <Card style={styles.card}>
          <PharmaIcon name={AppIcons.scan} size={64} color={colors.primary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('orders.scanBatch')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Scan the batch number printed on the physical packaging to verify delivery
          </Text>

          <View style={styles.batchRow}>
            <Text style={[styles.batchLabel, { color: colors.textSecondary }]}>Declared Batch:</Text>
            <Text style={[styles.batchValue, { color: colors.textPrimary }]}>{declaredBatchNumber}</Text>
          </View>

          {scannedBatch && (
            <View style={styles.batchRow}>
              <Text style={[styles.batchLabel, { color: colors.textSecondary }]}>Scanned Batch:</Text>
              <Text
                style={[
                  styles.batchValue,
                  { color: colors.textPrimary },
                  !isMatch && { color: colors.danger },
                ]}
              >
                {scannedBatch}
              </Text>
              <StatusBadge
                status={isMatch ? 'safe' : 'danger'}
                label={isMatch ? t('common.match') : t('common.mismatch')}
                size="sm"
              />
            </View>
          )}

          {!scannedBatch ? (
            <Button
              title={t('orders.scanBatch')}
              onPress={handleScan}
              loading={isProcessing}
              fullWidth
              size="lg"
              iconName={AppIcons.scan}
            />
          ) : isMatch ? (
            <Button
              title={t('orders.confirmDelivery')}
              onPress={handleConfirm}
              loading={loading}
              variant="safe"
              fullWidth
              size="lg"
              iconName={AppIcons.check}
            />
          ) : (
            <View>
              <Text style={[styles.warning, { color: colors.danger }]}>
                {t('orders.batchMismatch')}
              </Text>
              <Button
                title={t('batchscan.confirmMismatch')}
                onPress={handleConfirm}
                loading={loading}
                variant="danger"
                fullWidth
                size="lg"
                iconName={AppIcons.alert}
              />
            </View>
          )}
        </Card>

        {/* Manual batch number input modal */}
        <Modal visible={showManualInput} transparent animationType="fade" onRequestClose={() => setShowManualInput(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowManualInput(false)} accessibilityLabel={t('common.cancel')}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('batchscan.enterBatchNumber')}</Text>
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                {t('batchscan.typeBatchHint')}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={manualBatchInput}
                onChangeText={setManualBatchInput}
                placeholder={t('batchscan.batchPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoFocus
                accessibilityLabel={t('batchscan.enterBatchNumber')}
              />
              <View style={styles.modalButtons}>
                <Button
                  title={t('common.cancel')}
                  onPress={() => { setShowManualInput(false); setManualBatchInput(''); }}
                  variant="ghost"
                  style={{ flex: 1 }}
                />
                <Button
                  title={t('common.confirm')}
                  onPress={() => {
                    if (manualBatchInput.trim()) {
                      setScannedBatch(manualBatchInput.trim());
                      setShowManualInput(false);
                      setManualBatchInput('');
                    }
                  }}
                  variant="primary"
                  style={{ flex: 1 }}
                  disabled={!manualBatchInput.trim()}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {error && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
            ]}
          >
            <PharmaIcon name={AppIcons.alert} size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            <Button title={t('common.retry')} onPress={handleConfirm} variant="danger" size="sm" />
          </View>
        )}

        {result && (
          <Card
            style={[
              styles.resultCard,
              {
                borderColor: result.state === 'SETTLED' ? colors.safe : colors.danger,
              },
            ]}
          >
            <PharmaIcon
              name={result.state === 'SETTLED' ? AppIcons.verified : AppIcons.alert}
              size={48}
              color={result.state === 'SETTLED' ? colors.safe : colors.danger}
            />
            <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>
              {result.state === 'SETTLED' ? t('orders.batchMatch') : t('orders.batchMismatch')}
            </Text>
            {result.dispute_ticket_id && (
              <Text style={[styles.resultDetail, { color: colors.textSecondary }]}>
                {t('batchscan.disputeOpened', { id: result.dispute_ticket_id.slice(0, 8) })}
              </Text>
            )}
            <Button
              title={t('batchscan.backToOrders')}
              onPress={() => navigation.goBack()}
              variant="ghost"
              style={{ marginTop: Spacing.lg }}
            />
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  card: { padding: Spacing.xl, alignItems: 'center' },
  title: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    width: '100%',
  },
  batchLabel: {
    ...Typography.bodySmall,
    width: 120,
  },
  batchValue: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
  },
  warning: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  resultCard: {
    marginTop: Spacing.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
  },
  resultTitle: {
    ...Typography.h2,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  resultDetail: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  errorText: { ...Typography.bodySmall, flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { ...Typography.h2, marginBottom: Spacing.xs },
  modalHint: { ...Typography.bodySmall, marginBottom: Spacing.lg },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: Spacing.lg,
  },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
});
