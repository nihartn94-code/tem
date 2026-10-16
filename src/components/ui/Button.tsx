import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import { useColors, BorderRadius, Typography, Spacing, useShadows } from '../../config/theme';
import { PharmaIcon, type IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'safe' | 'pending' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconName?: IconName;
  iconColor?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const getVariantStyles = (variant: ButtonVariant, colors: ReturnType<typeof useColors>) => {
  switch (variant) {
    case 'primary':
      return { bg: colors.primary, text: colors.primaryText, border: colors.primary };
    case 'secondary':
      return { bg: colors.secondary, text: colors.secondaryText, border: colors.secondary };
    case 'tertiary':
      return { bg: colors.surfaceElevated, text: colors.textPrimary, border: colors.border };
    case 'safe':
      return { bg: colors.safe, text: '#FFFFFF', border: colors.safe };
    case 'pending':
      return { bg: colors.pending, text: '#FFFFFF', border: colors.pending };
    case 'danger':
      return { bg: colors.danger, text: '#FFFFFF', border: colors.danger };
    case 'ghost':
      return { bg: 'transparent', text: colors.primary, border: 'transparent' };
    case 'icon':
      return { bg: 'transparent', text: colors.textPrimary, border: 'transparent' };
    default:
      return { bg: colors.primary, text: colors.primaryText, border: colors.primary };
  }
};

const getSizeStyles = (size: ButtonSize) => {
  switch (size) {
    case 'sm':
      return { paddingVertical: 8, paddingHorizontal: Spacing.lg, fontSize: 14, minHeight: 36 };
    case 'md':
      return { paddingVertical: 12, paddingHorizontal: Spacing.xl, fontSize: 16, minHeight: 44 };
    case 'lg':
      return { paddingVertical: 16, paddingHorizontal: Spacing.xxl, fontSize: 16, minHeight: 52 };
    default:
      return { paddingVertical: 12, paddingHorizontal: Spacing.xl, fontSize: 16, minHeight: 44 };
  }
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconName,
  iconColor,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const colors = useColors();
  const shadows = useShadows();
  const variantStyles = getVariantStyles(variant, colors);
  const sizeStyles = getSizeStyles(size);

  const isIconOnly = variant === 'icon';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: disabled ? colors.border : variantStyles.bg,
          borderWidth: variant === 'tertiary' ? 1 : 0,
          borderColor: variantStyles.border,
          paddingVertical: isIconOnly ? 8 : sizeStyles.paddingVertical,
          paddingHorizontal: isIconOnly ? 8 : sizeStyles.paddingHorizontal,
          minHeight: isIconOnly ? 40 : sizeStyles.minHeight,
          width: isIconOnly ? 40 : undefined,
          opacity: pressed ? 0.7 : 1,
        },
        fullWidth && styles.fullWidth,
        !disabled && variant !== 'ghost' && variant !== 'icon' && shadows.sm,
        style,
      ]}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.text} size="small" />
      ) : (
        <>
          {iconName && (
            <PharmaIcon
              name={iconName}
              size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18}
              color={iconColor || variantStyles.text}
            />
          )}
          {icon && !iconName && icon}
          {!isIconOnly && (
            <Text
              style={[
                styles.text,
                {
                  color: disabled ? colors.textTertiary : variantStyles.text,
                  fontSize: sizeStyles.fontSize,
                  marginLeft: (icon || iconName) ? Spacing.sm : 0,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    ...Typography.button,
    textAlign: 'center',
  },
});
