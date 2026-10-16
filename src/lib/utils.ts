import type { OrderState, UserRole } from './types';
import type { Palette } from '../config/theme';

// ============================================================
// Formatting Utilities
// ============================================================

export const formatCurrency = (amount: number): string => {
 return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateStr: string): string => {
 return new Date(dateStr).toLocaleDateString('en-IN', {
 day: 'numeric',
 month: 'short',
 year: 'numeric',
 });
};

export const formatExpiry = (dateStr: string): string => {
 const date = new Date(dateStr);
 const now = new Date();
 const daysUntilExpiry = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

 if (daysUntilExpiry < 0) return 'Expired';
 if (daysUntilExpiry < 30) return `${daysUntilExpiry}d left`;
 if (daysUntilExpiry < 365) return `${Math.floor(daysUntilExpiry / 30)}mo left`;
 return `${Math.floor(daysUntilExpiry / 365)}y left`;
};

export const formatOTP = (otp: string): string => {
 return otp.split('').join(' ');
};

// ============================================================
// Status Mapping (SRS §5: Three-color system)
// ============================================================

export const getOrderStateColor = (state: OrderState): 'safe' | 'pending' | 'danger' => {
 switch (state) {
 case 'DELIVERED_CONFIRMED':
 case 'SETTLED':
 case 'REFUNDED':
 return 'safe';
 case 'DISPUTED':
 return 'danger';
 default:
 return 'pending';
 }
};

export const getRoleColor = (role: UserRole, colors: Palette): string => {
 const map: Record<UserRole, string> = {
 ADMIN: colors.roleAdmin,
 MANUFACTURER: colors.roleManufacturer,
 PHARMA_COMPANY: colors.roleCompany,
 STOCKIST: colors.roleStockist,
 };
 return map[role] || colors.primary;
};

export const getRoleLabel = (role: UserRole): string => {
 const map: Record<UserRole, string> = {
 ADMIN: 'Admin',
 MANUFACTURER: 'Manufacturer',
 PHARMA_COMPANY: 'Company',
 STOCKIST: 'Stockist',
 };
 return map[role] || role;
};

// ============================================================
// Distance Calculation (SRS §6.3 anti-split-account)
// ============================================================

export const calculateDistanceKm = (
 lat1: number,
 lng1: number,
 lat2: number,
 lng2: number
): number => {
 const R = 6371; // Earth's radius in km
 const dLat = toRad(lat2 - lat1);
 const dLng = toRad(lng2 - lng1);
 const a =
 Math.sin(dLat / 2) * Math.sin(dLat / 2) +
 Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
 Math.sin(dLng / 2) * Math.sin(dLng / 2);
 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
 return R * c;
};

const toRad = (deg: number): number => deg * (Math.PI / 180);

// ============================================================
// Network Status
// ============================================================

export const isOnline = (state: { isConnected?: boolean | null } | null): boolean => {
 return state?.isConnected ?? true;
};

// ============================================================
// FRIENDLY ERROR MAPPING (master doc §24)
// Never surface raw backend/provider messages to the user.
// ============================================================

const ERROR_MAP: Record<string, string> = {
  UNAUTHORIZED: 'Please log in again',
  FORBIDDEN: 'You are not allowed to perform this action',
  NOT_FOUND: 'This item no longer exists',
  VALIDATION: 'Please check the entered details',
  INSUFFICIENT_STOCK: 'Not enough stock available for this order',
  OUT_OF_STOCK: 'This item is out of stock',
  STOCK_DECREMENT_FAILED: 'Stock was just taken by another buyer. Please retry.',
  DUPLICATE_CHECKOUT: 'This order was already placed',
  DELIVERY_MISMATCH: 'Delivery location is too far from your verified facility',
  COMPLIANCE_REQUIRED: 'Please complete compliance verification first',
  INVALID_STATE: 'This order was already processed',
  ALREADY_RESOLVED: 'This dispute was already resolved',
  INVALID_QUANTITY: 'Quantity must be a positive number',
  'Network request failed': 'Network problem. Check your connection and retry.',
  'Failed to fetch': 'Network problem. Check your connection and retry.',
};

export const friendlyError = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : String(err);
  for (const [key, message] of Object.entries(ERROR_MAP)) {
    if (raw.includes(key)) return message;
  }
  return fallback;
};
