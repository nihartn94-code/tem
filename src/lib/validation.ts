import { z } from 'zod';

// ============================================================
// Shared Zod Schemas — One source of truth for valid payloads
// Used by React Hook Form (client) AND Edge Functions (server)
// ============================================================

// --- Auth ---
export const PhoneSchema = z.object({
 phone: z
 .string()
 .min(10, 'Phone number must be at least 10 digits')
 .max(15, 'Phone number too long')
 .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
});

export const OTPSchema = z.object({
 otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

// --- Role Selection ---
export const RoleSchema = z.object({
 role: z.enum(['MANUFACTURER', 'PHARMA_COMPANY', 'STOCKIST'], {
 error: 'Please select a role',
 }),
});

// --- Compliance Onboarding (04-API-SPEC.md §2.1) ---
export const GSTINSchema = z
 .string()
 .regex(
 /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
 'Invalid GSTIN format'
 );

export const DrugLicenseSchema = z.object({
 legal_entity_name: z.string().min(2, 'Legal entity name required'),
 gstin: GSTINSchema,
 drug_license_number: z.string().min(3, 'Drug license number required'),
 drug_license_expiry: z
 .string()
 .refine((date) => new Date(date) > new Date(), { message: 'License expiry must be in the future' }),
 who_gmp_certified: z.boolean().default(false),
 facility_lat: z.number().min(-90).max(90),
 facility_lng: z.number().min(-180).max(180),
 license_doc_storage_path: z.string().optional().default(''),
 gmp_cert_storage_path: z.string().nullable().optional(),
});

// --- Molecule Search (04-API-SPEC.md §2.2) ---
export const SearchQuerySchema = z.object({
 query: z.string().min(1, 'Search query required'),
 language: z.enum(['en', 'hi']).default('en'),
});

// --- Basket Scan Match (04-API-SPEC.md §2.3) ---
export const BasketScanSchema = z.object({
 ocr_extracted_lines: z
 .array(z.string())
 .min(1, 'At least one line required from OCR'),
});

// --- Checkout (04-API-SPEC.md §2.4) ---
export const CheckoutItemSchema = z.object({
 marketplace_listing_id: z.string().uuid(),
 quantity: z.number().int().positive('Quantity must be positive'),
});

export const CheckoutSchema = z.object({
 items: z.array(CheckoutItemSchema).min(1, 'At least one item required'),
 payment_channel: z.enum(['ESCROW_INSTANT', 'NBFC_CREDIT_LINE', 'STANDARD_CREDIT_TERMS']),
 delivery_lat: z.number().min(-90).max(90),
 delivery_lng: z.number().min(-180).max(180),
});

// --- Batch Delivery Confirmation (04-API-SPEC.md §2.5) ---
export const BatchDeliverySchema = z.object({
 order_id: z.string().uuid(),
 scanned_batch_number: z.string().min(1, 'Batch number required'),
});

// --- Dispute Resolution (04-API-SPEC.md §2.6) ---
export const DisputeResolutionSchema = z.object({
 dispute_ticket_id: z.string().uuid(),
 resolution: z.enum(['RELEASED_TO_SELLER', 'REFUNDED_TO_BUYER']),
});

// --- Platform Settings (04-API-SPEC.md §2.7) ---
export const PlatformSettingsSchema = z.object({
 global_fee_pct: z.number().min(0).max(100).optional(),
 cash_velocity_discount_default_pct: z.number().min(0).max(100).optional(),
 cash_velocity_discount_min_pct: z.number().min(0).max(100).optional(),
 cash_velocity_discount_max_pct: z.number().min(0).max(100).optional(),
 dispute_auto_flag_threshold: z.number().int().min(1).max(100).optional(),
});

// --- Production Pool Contribution (04-API-SPEC.md §2.8) ---
export const PoolContributionSchema = z.object({
 manufacturer_catalog_id: z.string().uuid(),
 requested_quantity: z.number().int().positive(),
 intended_brand_name: z.string().min(1),
 packaging_spec: z.record(z.string(), z.unknown()).nullable().optional(),
 agreed_unit_cost: z.number().positive(),
});

// --- Company Brand Registration ---
export const BrandRegistrationSchema = z.object({
 combination_id: z.string().uuid(),
 brand_name: z.string().min(2, 'Brand name required'),
 trademark_doc_storage_path: z.string().min(1, 'Trademark document required'),
});

// --- Marketplace Listing ---
export const MarketplaceListingSchema = z.object({
 brand_id: z.string().uuid(),
 batch_number: z.string().min(1, 'Batch number required'),
 expiry_date: z
 .string()
 .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry must be YYYY-MM-DD')
 .refine((d) => new Date(d) > new Date(), { message: 'Expiry must be in the future' }),
 wholesale_price_per_unit: z.number().positive('Price must be positive'),
 available_stock_units: z.number().int().min(0).max(1_000_000),
 trade_scheme: z
 .object({
 buy: z.number().int().positive(),
 get_free: z.number().int().min(0),
 })
 .nullable()
 .optional(),
});

// --- Type exports for form types ---
export type PhoneInput = z.infer<typeof PhoneSchema>;
export type OTPInput = z.infer<typeof OTPSchema>;
export type RoleInput = z.infer<typeof RoleSchema>;
export type DrugLicenseInput = z.infer<typeof DrugLicenseSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type BasketScanInput = z.infer<typeof BasketScanSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type BatchDeliveryInput = z.infer<typeof BatchDeliverySchema>;
export type DisputeResolutionInput = z.infer<typeof DisputeResolutionSchema>;
export type PlatformSettingsInput = z.infer<typeof PlatformSettingsSchema>;
export type PoolContributionInput = z.infer<typeof PoolContributionSchema>;
export type BrandRegistrationInput = z.infer<typeof BrandRegistrationSchema>;
export type MarketplaceListingInput = z.infer<typeof MarketplaceListingSchema>;
