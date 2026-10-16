import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useColors, BorderRadius, Typography, Spacing, useShadows } from '../../config/theme';
import { useMoleculeSearch } from '../../hooks/useDatabase';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { PharmaIcon, AppIcons } from '../ui/Icon';
import { useTranslation } from 'react-i18next';

interface SearchBarProps {
  onResultSelect: (combinationId: string) => void;
  placeholder?: string;
}

export function SearchBar({ onResultSelect, placeholder }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const { t } = useTranslation();
  const colors = useColors();
  const shadows = useShadows();
  const { isListening, transcript, startListening, stopListening } = useVoiceInput();
  const { data, isLoading, isError } = useMoleculeSearch(query);
  const [showResults, setShowResults] = useState(false);

  // Voice transcript feeds the SAME useMoleculeSearch query path as typing (§5 F4)
  React.useEffect(() => {
    if (transcript) {
      setQuery(transcript);
      setShowResults(transcript.length >= 2);
    }
  }, [transcript]);

  const handleVoicePress = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening('hi-IN');
    }
  }, [isListening, startListening, stopListening]);

  const handleResultPress = useCallback(
    (combinationId: string) => {
      onResultSelect(combinationId);
      setShowResults(false);
      setQuery('');
    },
    [onResultSelect]
  );

  const results = data?.combinations || [];

  return (
    <View style={styles.container}>
      {/* Search input with voice */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          shadows.sm,
        ]}
      >
        <PharmaIcon name={AppIcons.search} size={20} color={colors.textTertiary} />
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setShowResults(text.length >= 2);
          }}
          placeholder={placeholder || t('search.placeholder')}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={handleVoicePress}
          style={[
            styles.voiceButton,
            {
              backgroundColor: colors.background,
            },
            isListening && { backgroundColor: colors.dangerSurface },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
        >
          <PharmaIcon
            name={isListening ? AppIcons.microphoneOff : AppIcons.microphone}
            size={22}
            color={isListening ? colors.danger : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <PharmaIcon name={AppIcons.search} size={14} color={colors.textTertiary} />
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}> {t('common.searching')}</Text>
        </View>
      )}

      {/* Search results dropdown */}
      {showResults && results.length > 0 && (
        <View
          style={[
            styles.resultsContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            shadows.lg,
          ]}
        >
          <Text style={[styles.resultsHeader, { color: colors.textSecondary, borderBottomColor: colors.borderLight }]}>
            {t('search.foundCheapestFirst', { count: results.length })}
          </Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.combination_id}
            nestedScrollEnabled
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultItem, { borderBottomColor: colors.borderLight }]}
                onPress={() => handleResultPress(item.combination_id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.display_composition}, ${item.offers.length} brands available`}
              >
                <PharmaIcon name={AppIcons.pill} size={20} color={colors.primary} />
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultComposition, { color: colors.textPrimary }]}>
                    {item.display_composition}
                  </Text>
                  <Text style={[styles.resultOfferCount, { color: colors.textSecondary }]}>
                    {item.offers.length} brand{item.offers.length !== 1 ? 's' : ''} available
                  </Text>
                </View>
                {item.offers.length > 0 && (
                  <View style={styles.resultPrice}>
                    <Text style={[styles.resultPriceValue, { color: colors.safe }]}>
                      from ₹{item.offers[0].price_per_unit}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Search error — network failure must not masquerade as "no results" */}
      {showResults && !isLoading && isError && (
        <View
          style={[
            styles.noResults,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <PharmaIcon name="alert" size={32} color={colors.danger} />
          <Text style={[styles.noResultsText, { color: colors.danger }]}>
            {t('common.error')}
          </Text>
        </View>
      )}

      {/* No results */}
      {showResults && !isLoading && !isError && results.length === 0 && query.length >= 2 && (
        <View
          style={[
            styles.noResults,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <PharmaIcon name={AppIcons.search} size={32} color={colors.textTertiary} />
          <Text style={[styles.noResultsText, { color: colors.textTertiary }]}>
            {t('search.noResults', { query })}
          </Text>
        </View>
      )}

      {/* Voice listening indicator */}
      {isListening && (
        <View
          style={[
            styles.listeningContainer,
            {
              backgroundColor: colors.dangerSurface,
              borderColor: colors.danger,
            },
          ]}
        >
          <PharmaIcon name={AppIcons.microphone} size={24} color={colors.danger} />
          <Text style={[styles.listeningText, { color: colors.danger }]}>{t('search.listening')}</Text>
          <Text style={[styles.listeningHint, { color: colors.textSecondary }]}>
            {t('search.speakHint')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    minHeight: 48,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.md,
    marginLeft: Spacing.sm,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  loadingText: {
    ...Typography.caption,
  },
  resultsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    maxHeight: 320,
  },
  resultsHeader: {
    ...Typography.caption,
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  resultInfo: {
    flex: 1,
  },
  resultComposition: {
    ...Typography.body,
    fontWeight: '500',
  },
  resultOfferCount: {
    ...Typography.caption,
    marginTop: 2,
  },
  resultPrice: {
    marginLeft: Spacing.md,
  },
  resultPriceValue: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  noResults: {
    padding: Spacing.xl,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  noResultsText: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
  },
  listeningContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    gap: Spacing.sm,
  },
  listeningText: {
    ...Typography.body,
    fontWeight: '600',
  },
  listeningHint: {
    ...Typography.caption,
  },
});
