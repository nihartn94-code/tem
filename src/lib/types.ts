// ============================================================
// PharmaOS Database Types — Auto-generated shape from 03-DATABASE-SCHEMA.md
// ============================================================

export type UserRole = 'ADMIN' | 'MANUFACTURER' | 'PHARMA_COMPANY' | 'STOCKIST';

export type OrderState =
 | 'POOLING_ACTIVE'
 | 'BATCH_LOCKED'
 | 'IN_PRODUCTION'
 | 'DISPATCHED'
 | 'DELIVERED_PENDING_SCAN'
 | 'DELIVERED_CONFIRMED'
 | 'DISPUTED'
 | 'SETTLED'
 | 'REFUNDED';

export type PaymentChannel = 'ESCROW_INSTANT' | 'NBFC_CREDIT_LINE' | 'STANDARD_CREDIT_TERMS' | 'MANUAL_CONFIRMATION';

export type DisputeReason = 'BATCH_MISMATCH' | 'LATE_DELIVERY' | 'QUALITY_ISSUE' | 'QUANTITY_MISMATCH' | 'OTHER';

export type DisputeResolution = 'PENDING' | 'RELEASED_TO_SELLER' | 'REFUNDED_TO_BUYER';

export type VerificationStatus = 'pending' | 'verified' | 'suspended';

export type PoolStatus = 'open' | 'locked' | 'in_production' | 'completed';

// ============================================================
// Core Entity Types
// ============================================================

export interface User {
 id: string;
 auth_user_id: string;
 role: UserRole;
 phone_number: string | null;
 email: string | null;
 display_name: string;
 preferred_language: string;
 is_active: boolean;
 created_at: string;
}

export interface ComplianceProfile {
 id: string;
 user_id: string;
 legal_entity_name: string;
 gstin: string;
 drug_license_number: string;
 drug_license_expiry: string;
 who_gmp_certified: boolean;
 license_doc_storage_path: string | null;
 gmp_cert_storage_path: string | null;
 facility_lat: number;
 facility_lng: number;
 verification_status: VerificationStatus;
 last_verified_at: string | null;
 created_at: string;
 updated_at: string;
}

export interface ActiveCompliantUser {
 user_id: string;
 role: UserRole;
}

// ============================================================
// Molecule Database (SRS §3.2)
// ============================================================

export interface ChemicalSalt {
 id: string;
 salt_name: string;
 therapeutic_category: string | null;
 nlem_price_capped: boolean;
 created_at: string;
}

export interface FormulationCombination {
 id: string;
 combination_hash: string;
 display_composition: string;
 created_at: string;
}

export interface CombinationSaltBridge {
 id: string;
 combination_id: string;
 salt_id: string;
 strength_value: number;
 strength_unit: string;
}

// ============================================================
// Manufacturer Layer (SRS §3.3, hidden from Stockists)
// ============================================================

export interface ManufacturerCatalog {
 id: string;
 manufacturer_id: string;
 combination_id: string;
 minimum_order_qty: number;
 factory_gate_unit_cost: number;
 lead_time_days: number;
 is_active: boolean;
 updated_at: string;
}

export interface ProductionPool {
 id: string;
 manufacturer_catalog_id: string;
 target_quantity: number;
 accumulated_quantity: number;
 status: PoolStatus;
 locked_at: string | null;
 created_at: string;
}

export interface ProductionPoolContribution {
 id: string;
 pool_id: string;
 company_id: string;
 requested_quantity: number;
 intended_brand_name: string;
 packaging_spec: Record<string, unknown> | null;
 agreed_unit_cost: number;
 created_at: string;
}

// ============================================================
// The Mandatory Bridge: Company → Stockist (SRS §1.2)
// ============================================================

export interface CompanyBrand {
 id: string;
 company_id: string;
 combination_id: string;
 brand_name: string;
 trademark_doc_storage_path: string | null;
 is_verified_trademark: boolean;
 created_at: string;
}

// ============================================================
// Stockist Marketplace (SRS §3.4, §3.5)
// ============================================================

export interface StockistMarketplace {
 id: string;
 brand_id: string;
 company_id: string;
 batch_number: string;
 expiry_date: string;
 wholesale_price_per_unit: number;
 available_stock_units: number;
 trade_scheme: TradeScheme | null;
 updated_at: string;
 // Joined fields (not in DB, populated by queries)
 brand_name?: string;
 display_composition?: string;
}

export interface TradeScheme {
 buy: number;
 get_free: number;
}

// ============================================================
// Orders & Escrow (SRS §3.6, §3.7)
// ============================================================

export interface Order {
 id: string;
 layer: 'MFG_TO_COMPANY' | 'COMPANY_TO_STOCKIST';
 buyer_id: string;
 seller_id: string;
 marketplace_listing_id: string | null;
 pool_contribution_id: string | null;
 quantity: number;
 gross_invoice_value: number;
 platform_fee_pct: number;
 platform_fee_value: number;
 cash_velocity_discount_pct: number;
 net_seller_payout: number;
 payment_channel: PaymentChannel;
 declared_batch_number: string | null;
 scanned_batch_number: string | null;
 delivery_lat: number | null;
 delivery_lng: number | null;
 state: OrderState;
 escrow_provider_ref: string | null;
 created_at: string;
 settled_at: string | null;
}

// ============================================================
// Dispute Resolution (SRS §3.8)
// ============================================================

export interface DisputeTicket {
 id: string;
 order_id: string;
 raised_by: string;
 reason: DisputeReason;
 evidence_storage_paths: string[];
 resolution: DisputeResolution;
 resolved_by: string | null;
 resolved_at: string | null;
 created_at: string;
}

// ============================================================
// Admin Configuration (SRS §3.9)
// ============================================================

export interface PlatformSettings {
 id: number;
 global_fee_pct: number;
 cash_velocity_discount_default_pct: number;
 cash_velocity_discount_min_pct: number;
 cash_velocity_discount_max_pct: number;
 dispute_auto_flag_threshold: number;
 updated_by: string | null;
 updated_at: string;
}

export interface PlatformSettingsHistory {
 id: string;
 setting_name: string;
 old_value: string | null;
 new_value: string;
 changed_by: string;
 effective_at: string;
}

// ============================================================
// Audit Log (SRS §4 non-functional)
// ============================================================

export interface AuditLog {
 id: string;
 actor_id: string | null;
 action: string;
 entity_type: string;
 entity_id: string;
 metadata: Record<string, unknown> | null;
 created_at: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface SearchCombinationResult {
 combination_id: string;
 display_composition: string;
 offers: SearchOffer[];
}

export interface SearchOffer {
 brand_id: string;
 brand_name: string;
 company_id: string;
 price_per_unit: number;
 available_stock: number;
 trade_scheme: TradeScheme | null;
}

export interface SearchResponse {
 combinations: SearchCombinationResult[];
}

export interface BasketScanMatch {
 input_line: string;
 candidate_combination_id: string | null;
 confidence: number;
}

export interface BasketScanResponse {
 matches: BasketScanMatch[];
}

export interface CheckoutOrder {
 order_id: string;
 escrow_provider_ref: string;
 net_seller_payout: number;
 gross_invoice_value: number;
}

export interface CheckoutResponse {
 orders: CheckoutOrder[];
}

export interface BatchDeliveryResult {
 state: OrderState;
 dispute_ticket_id: string | null;
}

export interface PoolContributionResult {
 pool_id: string;
 pool_status: PoolStatus;
 accumulated_quantity: number;
 target_quantity: number;
}

export interface EdgeFunctionError {
 error: {
 code: string;
 message: string;
 field?: string;
 };
}

// ============================================================
// Component Props Types
// ============================================================

export type TabRoute = {
 name: string;
 icon: string;
 label: string;
};

export type StatusColor = 'safe' | 'pending' | 'danger';
