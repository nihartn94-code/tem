import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { useColors, BorderRadius, Typography, Spacing } from '../../config/theme';
import { PharmaIcon, AppIcons, type IconName } from './Icon';
import { useTranslation } from 'react-i18next';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  required?: boolean;
  containerStyle?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  required,
  containerStyle,
  accessibilityLabel,
  accessibilityHint,
  ...props
}: InputProps) {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        style={[
          styles.label,
          { color: error ? colors.danger : colors.textPrimary },
        ]}
        accessibilityRole="text"
      >
        {label}
        {required && <Text style={{ color: colors.danger }}> *</Text>}
      </Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderColor: error
              ? colors.danger
              : isFocused
              ? colors.borderFocus
              : colors.border,
          },
        ]}
      >
        {leftIcon && <PharmaIcon name={leftIcon as IconName} size={20} color={colors.textSecondary} style={styles.icon} />}
        <TextInput
          style={[
            styles.input,
            { color: colors.textPrimary },
            leftIcon ? styles.inputWithIcon : null,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={accessibilityLabel || label}
          accessibilityHint={accessibilityHint}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconContainer}
            accessibilityRole="button"
            accessibilityLabel="Toggle visibility"
          >
            <Text style={[styles.rightIcon, { color: colors.textSecondary }]}>{rightIcon}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text
          style={[styles.error, { color: colors.danger }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
    </View>
  );
}

// Camera-first input — SRS §5: Camera before keyboard.
// onCapture triggers the camera flow (consumer orchestrates upload via
// lib/documents.ts); when onTextChange is provided a manual-entry field is
// rendered as the keyboard fallback so the value is never un-typable
// (audit H6: batch numbers could only be 'captured' by a stub).
interface CameraInputProps {
  label: string;
  value: string;
  onCapture: () => void;
  onTextChange?: (text: string) => void;
  placeholder?: string;
  error?: string;
  accessibilityLabel?: string;
}

export function CameraInput({
  label,
  value,
  onCapture,
  onTextChange,
  placeholder,
  error,
  accessibilityLabel,
}: CameraInputProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <View
        style={[
          styles.cameraInputContainer,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.captureButton, { backgroundColor: colors.primarySurface }]}
          onPress={onCapture}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || `Capture ${label}`}
        >
          <PharmaIcon name={AppIcons.scan} size={20} color={colors.primary} />
          <Text style={[styles.captureLabel, { color: colors.primary }]}>
            {t('common.scan')}
          </Text>
        </TouchableOpacity>
        {onTextChange ? (
          <TextInput
            style={[styles.cameraInputEditable, { color: colors.textPrimary }]}
            value={value}
            onChangeText={onTextChange}
            placeholder={placeholder || t('common.scan')}
            placeholderTextColor={colors.textTertiary}
          />
        ) : (
          <View style={styles.cameraInputValue}>
            {value ? (
              <Text style={[styles.cameraInputText, { color: colors.textPrimary }]}>{value}</Text>
            ) : (
              <Text style={[styles.cameraInputPlaceholder, { color: colors.textTertiary }]}>
                {placeholder || t('common.scan')}
              </Text>
            )}
          </View>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

// Phone number input with country code
interface PhoneInputProps extends Omit<InputProps, 'keyboardType'> {
  countryCode?: string;
}

export function PhoneInput({ countryCode = '+91', ...props }: PhoneInputProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, props.containerStyle]}>
      {props.label && (
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {props.label}
          {props.required && <Text style={{ color: colors.danger }}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.phoneContainer,
          {
            backgroundColor: colors.surface,
            borderColor: props.error ? colors.danger : colors.border,
          },
        ]}
      >
        <View style={[styles.countryCode, { backgroundColor: colors.background }]}>
          <Text style={[styles.countryCodeText, { color: colors.textPrimary }]}>{countryCode}</Text>
        </View>
        <TextInput
          style={[styles.phoneInput, { color: colors.textPrimary }]}
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
          maxLength={15}
          accessibilityLabel={props.label || 'Phone number'}
          {...props}
        />
      </View>
      {props.error && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {props.error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  icon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.md,
  },
  inputWithIcon: {
    paddingLeft: Spacing.xs,
  },
  rightIconContainer: {
    padding: Spacing.sm,
  },
  rightIcon: {
    fontSize: 18,
  },
  error: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  // Camera input
  cameraInputContainer: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  captureButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  captureIcon: {
    fontSize: 24,
  },
  captureLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  cameraInputEditable: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 15,
  },
  cameraInputValue: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'center',
  },
  cameraInputText: {
    ...Typography.body,
  },
  cameraInputPlaceholder: {
    ...Typography.body,
  },
  // Phone input
  phoneContainer: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  countryCodeText: {
    ...Typography.body,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    ...Typography.body,
    padding: Spacing.md,
  },
});
