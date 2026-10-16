import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, Pressable, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../ui/Button';
import { PharmaIcon, AppIcons } from '../ui/Icon';
import { useOCR } from '../../hooks/useOCR';
import { useBasketScanMatch, type BasketScanMatch } from '../../hooks/useDatabase';
import { useColors, Typography, Spacing, BorderRadius } from '../../config/theme';
import { useTranslation } from 'react-i18next';
import { friendlyError } from '../../lib/utils';
import type { BasketItem } from '../../hooks/useDatabase';

// Master doc §5 F9/F10 + TC-09: camera-first Smart Basket.
// OCR lines are fuzzy-matched server-side, every line comes back with a
// confidence score, and lines below CONFIDENCE_THRESHOLD are NEVER added
// silently — they require explicit human confirmation.

export const CONFIDENCE_THRESHOLD = 0.6;

interface ScanRow {
  line: string;
  match: BasketScanMatch | null;
  selected: boolean;
  lowConfidence: boolean;
}

interface ScanToBasketModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (items: BasketItem[]) => void;
}

export function ScanToBasketModal({ visible, onClose, onAdd }: ScanToBasketModalProps) {
  const { t } = useTranslation();
  const colors = useColors();

  // Reset review state on close — reopening must show a fresh scan,
  // not the previous session's rows (audit M28)
  const handleClose = () => {
    setRows([]);
    setStage('idle');
    setError(null);
    onClose();
  };
  const { ensurePermission, isProcessing: ocrProcessing, scanOrderList } = useOCR();
  const scanMatchMutation = useBasketScanMatch();

  const [rows, setRows] = useState<ScanRow[]>([]);
  const [stage, setStage] = useState<'idle' | 'ocr' | 'review'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [listingsState, setListingsState] = useState<Record<string, ListingRow[]>>({});

  const handleScan = useCallback(async () => {
    const hasPermission = await ensurePermission();
    if (!hasPermission) return;
    setStage('ocr');
    setError(null);
    setRows([]);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: false,
      });
      if (result.canceled || !result.assets[0]) {
        setStage('idle');
        return;
      }
      const lines = await scanOrderList(result.assets[0].uri);
      if (lines.length === 0) {
        setError(t('basket.scan.noText'));
        setStage('idle');
        return;
      }
      const response = await scanMatchMutation.mutateAsync(lines);
      const fetched = await fetchListingsFor(response.matches);
      setListingsState(fetched);
      setRows(
        response.matches.map((m) => ({
          line: m.input_line,
          match: m,
          selected: m.confidence >= CONFIDENCE_THRESHOLD && m.candidate_combination_id !== null,
          lowConfidence: m.confidence < CONFIDENCE_THRESHOLD,
        }))
      );
      setStage('review');
    } catch (err) {
      setError(friendlyError(err, t('common.retry')));
      setStage('idle');
    }
  }, [ensurePermission, scanOrderList, scanMatchMutation, t]);

  // Fetch live offers for the matched combinations so each confirmed line
  // can become a real basket item bound to an actual marketplace listing.
  const fetchListingsFor = useCallback(async (matches: BasketScanMatch[]) => {
    const comboIds = Array.from(new Set(matches.map((m) => m.candidate_combination_id).filter(Boolean))) as string[];
    if (comboIds.length === 0) return {};
    const supabaseMod = await import('../../lib/supabase');
    const { data, error: qError } = await supabaseMod.supabase
      .from('stockist_marketplace')
      .select(`
        id, wholesale_price_per_unit, available_stock_units, trade_scheme, company_id,
        company_brands!inner(
          brand_name,
          combination_id,
          formulation_combinations!inner(display_composition)
        )
      `)
      .in('company_brands.combination_id', comboIds)
      .gt('available_stock_units', 0)
      .order('wholesale_price_per_unit', { ascending: true });
    if (qError) throw qError;
    const grouped: Record<string, ListingRow[]> = {};
    for (const row of (data as unknown as ListingRow[])) {
      const cid = row.company_brands.combination_id;
      if (!grouped[cid]) grouped[cid] = [];
      grouped[cid].push(row);
    }
    return grouped;
  }, []);

  // Toggle by index — duplicate OCR lines must toggle independently (audit M28)
  const toggleRow = (index: number) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  };

  const handleAdd = () => {
    const items: BasketItem[] = [];
    for (const row of rows) {
      if (!row.selected || !row.match?.candidate_combination_id) continue;
      const offers = listingsState[row.match.candidate_combination_id] ?? [];
      const cheapest = offers[0]; // pre-sorted cheapest-first (§5 F10)
      if (!cheapest) continue;
      items.push({
        id: cheapest.id,
        listingId: cheapest.id,
        brandName: cheapest.company_brands.brand_name,
        composition: cheapest.company_brands.formulation_combinations.display_composition,
        pricePerUnit: Number(cheapest.wholesale_price_per_unit),
        quantity: 1,
        availableStock: cheapest.available_stock_units,
        tradeScheme: cheapest.trade_scheme ?? null,
      });
    }
    onAdd(items);
    onClose();
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const busy = ocrProcessing || scanMatchMutation.isPending;

  const renderRow = ({ item, index }: { item: ScanRow; index: number }) => {
    const disabled = item.lowConfidence && !item.match?.candidate_combination_id;
    return (
      <Pressable
        onPress={() => !disabled && toggleRow(index)}
        style={[styles.row, { borderColor: colors.border }, item.selected && { borderColor: colors.safe, backgroundColor: colors.safeSurface }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.selected }}
        accessibilityLabel={`${item.line}, ${item.lowConfidence ? t('basket.scan.lowConfidence') : t('basket.scan.confirmed')}`}
      >
        <View style={[styles.checkbox, { borderColor: colors.border }, item.selected && { backgroundColor: colors.safe, borderColor: colors.safe }]}>
          {item.selected && <PharmaIcon name={AppIcons.check} size={14} color={colors.primaryText} />}
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.lineText, { color: colors.textPrimary }]} numberOfLines={2}>{item.line}</Text>
          {item.match?.candidate_combination_id ? (
            <Text style={[styles.matchText, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('basket.scan.matchedTo')}: {item.match.candidate_combination_id.slice(0, 8)} · {Math.round(item.match.confidence * 100)}%
            </Text>
          ) : (
            <Text style={[styles.matchText, { color: colors.danger }]}>{t('basket.scan.noMatch')}</Text>
          )}
        </View>
        {item.lowConfidence && item.match?.candidate_combination_id && (
          <View style={[styles.flagBadge, { backgroundColor: colors.pendingSurface }]}>
            <Text style={[styles.flagText, { color: colors.pendingText }]}>{t('basket.scan.confirmManually')}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={[styles.headerTitle, { color: colors.primaryText }]}>{t('basket.scan.title')}</Text>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel={t('common.cancel')} hitSlop={12}>
            <PharmaIcon name={AppIcons.close} size={22} color={colors.primaryText} />
          </Pressable>
        </View>

        {stage === 'idle' && (
          <View style={styles.centered}>
            <PharmaIcon name={AppIcons.scan} size={72} color={colors.primary} />
            <Text style={[styles.idleTitle, { color: colors.textPrimary }]}>{t('basket.scan.idleTitle')}</Text>
            <Text style={[styles.idleHint, { color: colors.textSecondary }]}>{t('basket.scan.idleHint')}</Text>
            {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
            <Button title={t('basket.scan.openCamera')} onPress={handleScan} iconName={AppIcons.scan} size="lg" />
          </View>
        )}

        {(busy || stage === 'ocr') && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.idleHint, { color: colors.textSecondary }]}>{t('basket.scan.processing')}</Text>
          </View>
        )}

        {stage === 'review' && !busy && (
          <>
            <View style={[styles.reviewBanner, { backgroundColor: colors.pendingSurface }]}>
              <Text style={[styles.reviewText, { color: colors.pendingText }]}>
                {t('basket.scan.reviewHint', { count: rows.length, selected: selectedCount })}
              </Text>
            </View>
            <FlatList
              data={rows}
              keyExtractor={(item, index) => `${index}_${item.line.slice(0, 24)}`}
              renderItem={renderRow}
              contentContainerStyle={styles.listContent}
            />
            {error && <Text style={[styles.errorText, { color: colors.danger, paddingHorizontal: Spacing.lg }]}>{error}</Text>}
            <View style={styles.footer}>
              <Button
                title={t('basket.scan.addToBasket', { count: selectedCount })}
                onPress={handleAdd}
                disabled={selectedCount === 0}
                fullWidth
                size="lg"
                iconName={AppIcons.basket}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

interface ListingRow {
  id: string;
  wholesale_price_per_unit: string | number;
  available_stock_units: number;
  trade_scheme: { buy: number; get_free: number } | null;
  company_brands: {
    brand_name: string;
    combination_id: string;
    formulation_combinations: { display_composition: string };
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: { ...Typography.h3 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  idleTitle: { ...Typography.h2, textAlign: 'center' },
  idleHint: { ...Typography.body, textAlign: 'center' },
  errorText: { ...Typography.body, textAlign: 'center', paddingBottom: Spacing.sm },
  reviewBanner: { margin: Spacing.lg, marginBottom: 0, padding: Spacing.sm, borderRadius: BorderRadius.sm },
  reviewText: { ...Typography.caption, fontWeight: '600' },
  listContent: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  rowText: { flex: 1 },
  lineText: { ...Typography.body, fontWeight: '600' },
  matchText: { ...Typography.caption, marginTop: 2 },
  flagBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  flagText: { ...Typography.caption, fontWeight: '700' },
  footer: { padding: Spacing.lg },
});
