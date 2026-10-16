import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, Typography, Spacing, BorderRadius } from '../../config/theme';
import { PharmaIcon } from './Icon';
import { getBoundaryText } from '../../config/i18nBoundary';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Wrapper component to provide colors to class component
function ErrorBoundaryContent({ hasError, error, onRetry }: { hasError: boolean; error: Error | null; onRetry: () => void }) {
  const colors = useColors();
  const bt = getBoundaryText();

  if (!hasError) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PharmaIcon name="alert" size={64} color={colors.danger} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{bt.title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {error?.message || bt.message}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={bt.retryLabel}
      >
        <PharmaIcon name="refresh" size={20} color={colors.primaryText} />
        <Text style={[styles.buttonText, { color: colors.primaryText }]}>{bt.retryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryContent
          hasError={this.state.hasError}
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  buttonText: {
    ...Typography.body,
    fontWeight: '600',
  },
});
