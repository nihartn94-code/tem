import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../../config/theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface PharmaIconProps {
 name: IconName;
 size?: number;
 color?: string;
 style?: object;
}

/**
 * PharmaOS unified icon component.
 * Every icon in the app goes through this — one icon set, one source of truth.
 * Uses MaterialCommunityIcons for consistent, high-quality vector icons.
 */
export function PharmaIcon({
 name,
 size = 24,
 color,
 style,
}: PharmaIconProps) {
 const colors = useColors();
 return (
 <MaterialCommunityIcons
 name={name}
 size={size}
 color={color ?? colors.textPrimary}
 style={style}
 />
 );
}

// ============================================================
// Semantic icon name mappings — SRS §5 icon + number paradigm
// ============================================================

export const AppIcons = {
 // Navigation
 home: 'home' as IconName,
 marketplace: 'store' as IconName,
 basket: 'cart' as IconName,
 orders: 'clipboard-text-outline' as IconName,
 profile: 'account-circle' as IconName,
 brands: 'tag-multiple' as IconName,
 catalog: 'factory' as IconName,
 admin: 'cog' as IconName,

 // Status
 verified: 'check-circle' as IconName,
 pending: 'clock-outline' as IconName,
 alert: 'alert-circle' as IconName,
 danger: 'close-circle' as IconName,
 safe: 'shield-check' as IconName,

 // Actions
 search: 'magnify' as IconName,
 camera: 'camera' as IconName,
 microphone: 'microphone' as IconName,
 microphoneOff: 'microphone-off' as IconName,
 add: 'plus' as IconName,
 remove: 'minus' as IconName,
 delete: 'delete-outline' as IconName,
 edit: 'pencil' as IconName,
 refresh: 'refresh' as IconName,
 back: 'arrow-left' as IconName,
 forward: 'arrow-right' as IconName,
 logout: 'logout' as IconName,
 check: 'check' as IconName,
 close: 'close' as IconName,
 retry: 'reload' as IconName,
 undo: 'undo' as IconName,

 // Pharma
 pill: 'pill' as IconName,
 flask: 'flask' as IconName,
 truck: 'truck-delivery' as IconName,
 packageCheck: 'package-variant-closed-check' as IconName,
 scan: 'barcode-scan' as IconName,
 batch: 'barcode' as IconName,

 // Commerce
 rupee: 'currency-inr' as IconName,
 receipt: 'receipt' as IconName,
 handshake: 'handshake-outline' as IconName,
 trade: 'swap-horizontal' as IconName,

 // Communication
 broadcast: 'bullhorn' as IconName,
 notification: 'bell-outline' as IconName,
 info: 'information-outline' as IconName,
 warning: 'alert-outline' as IconName,

 // Network & Status
 wifi: 'wifi' as IconName,
 wifiOff: 'wifi-off' as IconName,
 signal: 'signal-cellular-3' as IconName,
 database: 'database' as IconName,
 server: 'server' as IconName,
 cloud: 'cloud-check' as IconName,

 // Finance
 escrow: 'shield-lock' as IconName,
 discount: 'tag-outline' as IconName,
 payment: 'credit-card-outline' as IconName,

 // People
 user: 'account' as IconName,
 users: 'account-group' as IconName,
 manufacturer: 'factory' as IconName,
 company: 'domain' as IconName,
 stockist: 'package-variant' as IconName,
} as const;
