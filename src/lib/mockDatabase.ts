import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User,
  CompanyBrand,
  StockistMarketplace,
  ManufacturerCatalog,
  ProductionPool,
  Order,
  DisputeTicket,
  PlatformSettings,
  SearchCombinationResult,
  BasketScanMatch,
  CheckoutResponse,
  BatchDeliveryResult,
  PoolContributionResult,
} from './types';
import { Config } from '../config';

export interface MockPoolDispatchResult {
  created: { order_id: string; company_id: string }[];
  skipped: { contribution_id: string; reason: string }[];
  pool_status: string;
}

// ============================================================
// Initial Mock Seed Data
// ============================================================

export const MOCK_USERS: Record<string, User> = {
  admin: {
    id: 'u-admin-001',
    auth_user_id: 'auth-admin-001',
    role: 'ADMIN',
    phone_number: '+919999900001',
    email: 'admin@pharmaos.io',
    display_name: 'Admin User',
    preferred_language: 'en',
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  mfg: {
    id: 'u-mfg-001',
    auth_user_id: 'auth-mfg-001',
    role: 'MANUFACTURER',
    phone_number: '+919999900002',
    email: 'mfg@pharmaos.io',
    display_name: 'Apex Pharma Manufacturing Ltd',
    preferred_language: 'en',
    is_active: true,
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  company: {
    id: 'u-comp-001',
    auth_user_id: 'auth-comp-001',
    role: 'PHARMA_COMPANY',
    phone_number: '+919999900003',
    email: 'company@pharmaos.io',
    display_name: 'MedLife Therapeutics Pvt Ltd',
    preferred_language: 'en',
    is_active: true,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  stockist: {
    id: 'u-stock-001',
    auth_user_id: 'auth-stock-001',
    role: 'STOCKIST',
    phone_number: '+919999900004',
    email: 'stockist@pharmaos.io',
    display_name: 'City Meds Wholesale & Stockist',
    preferred_language: 'en',
    is_active: true,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
};

export const MOCK_COMBINATIONS = [
  { id: 'fc-001', combination_hash: 'amlo5', display_composition: 'Amlodipine 5mg', created_at: '2026-01-01' },
  { id: 'fc-002', combination_hash: 'amlo5_atorv10', display_composition: 'Amlodipine 5mg + Atorvastatin 10mg', created_at: '2026-01-01' },
  { id: 'fc-003', combination_hash: 'panto40', display_composition: 'Pantoprazole 40mg', created_at: '2026-01-01' },
  { id: 'fc-004', combination_hash: 'ceti10', display_composition: 'Cetirizine 10mg', created_at: '2026-01-01' },
  { id: 'fc-005', combination_hash: 'azi500', display_composition: 'Azithromycin 500mg', created_at: '2026-01-01' },
  { id: 'fc-006', combination_hash: 'para650', display_composition: 'Paracetamol 650mg', created_at: '2026-01-01' },
  { id: 'fc-007', combination_hash: 'met500', display_composition: 'Metformin 500mg', created_at: '2026-01-01' },
  { id: 'fc-008', combination_hash: 'amox500_clav125', display_composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg', created_at: '2026-01-01' },
  { id: 'fc-009', combination_hash: 'ibu400', display_composition: 'Ibuprofen 400mg', created_at: '2026-01-01' },
  { id: 'fc-010', combination_hash: 'levo50', display_composition: 'Levothyroxine 50mcg', created_at: '2026-01-01' },
];

export const MOCK_COMPANY_BRANDS: (CompanyBrand & { formulation_combinations?: { display_composition: string } })[] = [
  {
    id: 'cb-001',
    company_id: 'u-comp-001',
    combination_id: 'fc-001',
    brand_name: 'Amlopin-5',
    trademark_doc_storage_path: 'documents/u-comp-001/trademark_amlo.jpg',
    is_verified_trademark: true,
    created_at: '2026-02-01',
    formulation_combinations: { display_composition: 'Amlodipine 5mg' },
  },
  {
    id: 'cb-002',
    company_id: 'u-comp-001',
    combination_id: 'fc-002',
    brand_name: 'Amlop-AT',
    trademark_doc_storage_path: 'documents/u-comp-001/trademark_amat.jpg',
    is_verified_trademark: true,
    created_at: '2026-02-01',
    formulation_combinations: { display_composition: 'Amlodipine 5mg + Atorvastatin 10mg' },
  },
  {
    id: 'cb-003',
    company_id: 'u-comp-001',
    combination_id: 'fc-003',
    brand_name: 'Pantop-40',
    trademark_doc_storage_path: 'documents/u-comp-001/trademark_panto.jpg',
    is_verified_trademark: true,
    created_at: '2026-02-01',
    formulation_combinations: { display_composition: 'Pantoprazole 40mg' },
  },
  {
    id: 'cb-004',
    company_id: 'u-comp-001',
    combination_id: 'fc-004',
    brand_name: 'Cetzine-10',
    trademark_doc_storage_path: 'documents/u-comp-001/trademark_cetz.jpg',
    is_verified_trademark: true,
    created_at: '2026-02-01',
    formulation_combinations: { display_composition: 'Cetirizine 10mg' },
  },
  {
    id: 'cb-005',
    company_id: 'u-comp-001',
    combination_id: 'fc-005',
    brand_name: 'Azithral-500',
    trademark_doc_storage_path: 'documents/u-comp-001/trademark_azi.jpg',
    is_verified_trademark: true,
    created_at: '2026-02-01',
    formulation_combinations: { display_composition: 'Azithromycin 500mg' },
  },
  {
    id: 'cb-006',
    company_id: 'u-comp-001',
    combination_id: 'fc-006',
    brand_name: 'Dolo-650 Plus',
    trademark_doc_storage_path: 'documents/u-comp-001/trademark_dolo.jpg',
    is_verified_trademark: true,
    created_at: '2026-02-01',
    formulation_combinations: { display_composition: 'Paracetamol 650mg' },
  },
];

export const MOCK_MARKETPLACE: (StockistMarketplace & {
  brand_name: string;
  display_composition: string;
  company_brands: {
    brand_name: string;
    combination_id: string;
    formulation_combinations: { display_composition: string };
  };
})[] = [
  {
    id: 'mkt-001',
    brand_id: 'cb-001',
    company_id: 'u-comp-001',
    batch_number: 'AMLO5-2026A',
    expiry_date: '2027-12-31',
    wholesale_price_per_unit: 1.40,
    available_stock_units: 30000,
    trade_scheme: { buy: 20, get_free: 2 },
    updated_at: new Date().toISOString(),
    brand_name: 'Amlopin-5',
    display_composition: 'Amlodipine 5mg',
    company_brands: {
      brand_name: 'Amlopin-5',
      combination_id: 'fc-001',
      formulation_combinations: { display_composition: 'Amlodipine 5mg' },
    },
  },
  {
    id: 'mkt-002',
    brand_id: 'cb-002',
    company_id: 'u-comp-001',
    batch_number: 'AMAT40-2026A',
    expiry_date: '2027-11-30',
    wholesale_price_per_unit: 3.10,
    available_stock_units: 20000,
    trade_scheme: null,
    updated_at: new Date().toISOString(),
    brand_name: 'Amlop-AT',
    display_composition: 'Amlodipine 5mg + Atorvastatin 10mg',
    company_brands: {
      brand_name: 'Amlop-AT',
      combination_id: 'fc-002',
      formulation_combinations: { display_composition: 'Amlodipine 5mg + Atorvastatin 10mg' },
    },
  },
  {
    id: 'mkt-003',
    brand_id: 'cb-003',
    company_id: 'u-comp-001',
    batch_number: 'PANTO40-2026A',
    expiry_date: '2028-03-31',
    wholesale_price_per_unit: 2.05,
    available_stock_units: 25000,
    trade_scheme: { buy: 10, get_free: 1 },
    updated_at: new Date().toISOString(),
    brand_name: 'Pantop-40',
    display_composition: 'Pantoprazole 40mg',
    company_brands: {
      brand_name: 'Pantop-40',
      combination_id: 'fc-003',
      formulation_combinations: { display_composition: 'Pantoprazole 40mg' },
    },
  },
  {
    id: 'mkt-004',
    brand_id: 'cb-004',
    company_id: 'u-comp-001',
    batch_number: 'CETZ10-2026A',
    expiry_date: '2028-06-30',
    wholesale_price_per_unit: 0.95,
    available_stock_units: 40000,
    trade_scheme: null,
    updated_at: new Date().toISOString(),
    brand_name: 'Cetzine-10',
    display_composition: 'Cetirizine 10mg',
    company_brands: {
      brand_name: 'Cetzine-10',
      combination_id: 'fc-004',
      formulation_combinations: { display_composition: 'Cetirizine 10mg' },
    },
  },
  {
    id: 'mkt-005',
    brand_id: 'cb-005',
    company_id: 'u-comp-001',
    batch_number: 'AZI500-2026A',
    expiry_date: '2027-10-15',
    wholesale_price_per_unit: 6.90,
    available_stock_units: 12000,
    trade_scheme: { buy: 5, get_free: 1 },
    updated_at: new Date().toISOString(),
    brand_name: 'Azithral-500',
    display_composition: 'Azithromycin 500mg',
    company_brands: {
      brand_name: 'Azithral-500',
      combination_id: 'fc-005',
      formulation_combinations: { display_composition: 'Azithromycin 500mg' },
    },
  },
  {
    id: 'mkt-006',
    brand_id: 'cb-006',
    company_id: 'u-comp-001',
    batch_number: 'DOLO650-2026B',
    expiry_date: '2028-01-20',
    wholesale_price_per_unit: 1.80,
    available_stock_units: 50000,
    trade_scheme: { buy: 25, get_free: 2 },
    updated_at: new Date().toISOString(),
    brand_name: 'Dolo-650 Plus',
    display_composition: 'Paracetamol 650mg',
    company_brands: {
      brand_name: 'Dolo-650 Plus',
      combination_id: 'fc-006',
      formulation_combinations: { display_composition: 'Paracetamol 650mg' },
    },
  },
];

export const MOCK_CATALOG: (ManufacturerCatalog & { formulation_combinations?: { display_composition: string } })[] = [
  {
    id: 'cat-001',
    manufacturer_id: 'u-mfg-001',
    combination_id: 'fc-001',
    minimum_order_qty: 50000,
    factory_gate_unit_cost: 0.95,
    lead_time_days: 21,
    is_active: true,
    updated_at: new Date().toISOString(),
    formulation_combinations: { display_composition: 'Amlodipine 5mg' },
  },
  {
    id: 'cat-002',
    manufacturer_id: 'u-mfg-001',
    combination_id: 'fc-003',
    minimum_order_qty: 30000,
    factory_gate_unit_cost: 1.40,
    lead_time_days: 18,
    is_active: true,
    updated_at: new Date().toISOString(),
    formulation_combinations: { display_composition: 'Pantoprazole 40mg' },
  },
  {
    id: 'cat-003',
    manufacturer_id: 'u-mfg-001',
    combination_id: 'fc-005',
    minimum_order_qty: 15000,
    factory_gate_unit_cost: 4.80,
    lead_time_days: 25,
    is_active: true,
    updated_at: new Date().toISOString(),
    formulation_combinations: { display_composition: 'Azithromycin 500mg' },
  },
];

export const MOCK_POOLS: (ProductionPool & { manufacturer_catalog?: { manufacturer_id: string } })[] = [
  {
    id: 'pool-001',
    manufacturer_catalog_id: 'cat-001',
    target_quantity: 50000,
    accumulated_quantity: 38000,
    status: 'open',
    locked_at: null,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    manufacturer_catalog: { manufacturer_id: 'u-mfg-001' },
  },
  {
    id: 'pool-002',
    manufacturer_catalog_id: 'cat-002',
    target_quantity: 30000,
    accumulated_quantity: 30000,
    status: 'locked',
    locked_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    manufacturer_catalog: { manufacturer_id: 'u-mfg-001' },
  },
];

export const MOCK_ORDERS: (Order & {
  buyer: { display_name: string; role: string };
  seller: { display_name: string; role: string };
})[] = [
  {
    id: 'ord-001',
    layer: 'COMPANY_TO_STOCKIST',
    buyer_id: 'u-stock-001',
    seller_id: 'u-comp-001',
    marketplace_listing_id: 'mkt-001',
    pool_contribution_id: null,
    quantity: 5000,
    gross_invoice_value: 7000.00,
    platform_fee_pct: 1.5,
    platform_fee_value: 105.00,
    cash_velocity_discount_pct: 2.0,
    net_seller_payout: 6755.00,
    payment_channel: 'MANUAL_CONFIRMATION',
    declared_batch_number: 'AMLO5-2026A',
    scanned_batch_number: null,
    delivery_lat: 12.9716,
    delivery_lng: 77.5946,
    state: 'DELIVERED_PENDING_SCAN',
    escrow_provider_ref: 'upi_ref_1029384756',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    settled_at: null,
    buyer: { display_name: 'City Meds Wholesale & Stockist', role: 'STOCKIST' },
    seller: { display_name: 'MedLife Therapeutics Pvt Ltd', role: 'PHARMA_COMPANY' },
  },
  {
    id: 'ord-002',
    layer: 'COMPANY_TO_STOCKIST',
    buyer_id: 'u-stock-001',
    seller_id: 'u-comp-001',
    marketplace_listing_id: 'mkt-003',
    pool_contribution_id: null,
    quantity: 2000,
    gross_invoice_value: 4100.00,
    platform_fee_pct: 1.5,
    platform_fee_value: 61.50,
    cash_velocity_discount_pct: 2.0,
    net_seller_payout: 3956.50,
    payment_channel: 'MANUAL_CONFIRMATION',
    declared_batch_number: 'PANTO40-2026A',
    scanned_batch_number: 'PANTO40-2026A',
    delivery_lat: 12.9716,
    delivery_lng: 77.5946,
    state: 'DELIVERED_CONFIRMED',
    escrow_provider_ref: 'upi_ref_9928374615',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    settled_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    buyer: { display_name: 'City Meds Wholesale & Stockist', role: 'STOCKIST' },
    seller: { display_name: 'MedLife Therapeutics Pvt Ltd', role: 'PHARMA_COMPANY' },
  },
  {
    id: 'ord-003',
    layer: 'MFG_TO_COMPANY',
    buyer_id: 'u-comp-001',
    seller_id: 'u-mfg-001',
    marketplace_listing_id: null,
    pool_contribution_id: 'contrib-001',
    quantity: 30000,
    gross_invoice_value: 42000.00,
    platform_fee_pct: 1.5,
    platform_fee_value: 630.00,
    cash_velocity_discount_pct: 0,
    net_seller_payout: 41370.00,
    payment_channel: 'MANUAL_CONFIRMATION',
    declared_batch_number: 'PANTO40-MFG-01',
    scanned_batch_number: null,
    delivery_lat: 19.0760,
    delivery_lng: 72.8777,
    state: 'IN_PRODUCTION',
    escrow_provider_ref: 'upi_ref_5544332211',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    settled_at: null,
    buyer: { display_name: 'MedLife Therapeutics Pvt Ltd', role: 'PHARMA_COMPANY' },
    seller: { display_name: 'Apex Pharma Manufacturing Ltd', role: 'MANUFACTURER' },
  },
];

export const MOCK_DISPUTES: (DisputeTicket & {
  order?: { quantity: number; gross_invoice_value: number; declared_batch_number: string; scanned_batch_number: string };
  raiser?: { display_name: string };
  resolver?: { display_name: string };
})[] = [
  {
    id: 'disp-001',
    order_id: 'ord-001',
    raised_by: 'u-stock-001',
    reason: 'BATCH_MISMATCH',
    evidence_storage_paths: ['documents/u-stock-001/dispute_batch_photo.jpg'],
    resolution: 'PENDING',
    resolved_by: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    order: {
      quantity: 5000,
      gross_invoice_value: 7000.00,
      declared_batch_number: 'AMLO5-2026A',
      scanned_batch_number: 'AMLO5-2025Z',
    },
    raiser: { display_name: 'City Meds Wholesale & Stockist' },
    resolver: undefined,
  },
];

export const MOCK_PLATFORM_SETTINGS: PlatformSettings = {
  id: 1,
  global_fee_pct: 1.5,
  cash_velocity_discount_default_pct: 2.0,
  cash_velocity_discount_min_pct: 1.0,
  cash_velocity_discount_max_pct: 5.0,
  dispute_auto_flag_threshold: 3,
  updated_by: 'u-admin-001',
  updated_at: new Date().toISOString(),
};

export const MOCK_COMPLIANCE_PROFILES: Record<string, any> = {
  'u-admin-001': {
    id: 'cp-001',
    user_id: 'u-admin-001',
    legal_entity_name: 'PharmaOS Platform Admin',
    gstin: '29ABCDE1234F1Z5',
    drug_license_number: 'DL-ADMIN-2026',
    drug_license_expiry: '2030-12-31',
    who_gmp_certified: true,
    verification_status: 'verified',
  },
  'u-mfg-001': {
    id: 'cp-002',
    user_id: 'u-mfg-001',
    legal_entity_name: 'Apex Pharma Manufacturing Ltd',
    gstin: '27ABCDE5678F1Z2',
    drug_license_number: 'DL-MFG-MH-2024-9988',
    drug_license_expiry: '2028-09-30',
    who_gmp_certified: true,
    verification_status: 'verified',
  },
  'u-comp-001': {
    id: 'cp-003',
    user_id: 'u-comp-001',
    legal_entity_name: 'MedLife Therapeutics Pvt Ltd',
    gstin: '29AAACH1234M1ZV',
    drug_license_number: 'DL-COMP-KA-2024-5544',
    drug_license_expiry: '2028-11-15',
    who_gmp_certified: false,
    verification_status: 'verified',
  },
  'u-stock-001': {
    id: 'cp-004',
    user_id: 'u-stock-001',
    legal_entity_name: 'City Meds Wholesale & Stockist',
    gstin: '29AABCS9876P1Z3',
    drug_license_number: 'DL-KA-BLR-2023-102938',
    drug_license_expiry: '2028-08-31',
    who_gmp_certified: false,
    verification_status: 'verified',
  },
};

// ============================================================
// Mutable Database Store
// ============================================================

export class MockDataStore {
  users: User[] = Object.values(MOCK_USERS);
  combinations = [...MOCK_COMBINATIONS];
  company_brands = [...MOCK_COMPANY_BRANDS];
  stockist_marketplace = [...MOCK_MARKETPLACE];
  manufacturer_catalog = [...MOCK_CATALOG];
  production_pools = [...MOCK_POOLS];
  orders = [...MOCK_ORDERS];
  dispute_tickets = [...MOCK_DISPUTES];
  platform_settings: PlatformSettings = { ...MOCK_PLATFORM_SETTINGS };
  compliance_profiles: Record<string, any> = { ...MOCK_COMPLIANCE_PROFILES };
  audit_log: any[] = [];
  currentUser: User | null = null;

  async loadFromStorage() {
    try {
      const storedUser = await AsyncStorage.getItem('@pharmaos_mock_user');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }
    } catch {
      // ignore
    }
  }

  async setCurrentUser(user: User | null) {
    this.currentUser = user;
    try {
      if (user) {
        await AsyncStorage.setItem('@pharmaos_mock_user', JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem('@pharmaos_mock_user');
      }
    } catch {
      // ignore
    }
  }
}

export const mockStore = new MockDataStore();
void mockStore.loadFromStorage();

// ============================================================
// PostgREST Query Builder Simulation
// ============================================================

class MockQueryBuilder {
  private tableName: string;
  private filters: ((row: any) => boolean)[] = [];
  private sortFn: ((a: any, b: any) => number) | null = null;
  private limitCount: number | null = null;
  private isSingle = false;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_fields?: string) {
    this.action = 'select';
    return this;
  }

  insert(values: any) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    const colParts = column.split('.');
    this.filters.push((row) => {
      let curr = row;
      for (const p of colParts) {
        curr = curr?.[p];
      }
      return curr === value;
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row?.[column] !== value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row) => (row?.[column] ?? 0) > value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((row) => (row?.[column] ?? 0) >= value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row) => (row?.[column] ?? 0) < value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row) => (row?.[column] ?? 0) <= value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row?.[column]));
    return this;
  }

  or(filterString: string) {
    // Example: buyer_id.eq.xxx,seller_id.eq.xxx
    const conditions = filterString.split(',').map((clause) => {
      const [col, op, val] = clause.trim().split('.');
      return { col, op, val };
    });
    this.filters.push((row) => {
      return conditions.some(({ col, op, val }) => {
        if (op === 'eq') return row?.[col] === val;
        return true;
      });
    });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = { ascending: true }) {
    const asc = options.ascending ?? true;
    this.sortFn = (a, b) => {
      const valA = a?.[column];
      const valB = b?.[column];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      return asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  private execute(): { data: any; error: any } {
    const tableKey = this.tableName as keyof MockDataStore;
    let list: any[] = [];

    if (this.tableName === 'formulation_combinations') {
      list = [...mockStore.combinations];
    } else if (this.tableName === 'company_brands') {
      list = [...mockStore.company_brands];
    } else if (this.tableName === 'stockist_marketplace') {
      list = [...mockStore.stockist_marketplace];
    } else if (this.tableName === 'manufacturer_catalog') {
      list = [...mockStore.manufacturer_catalog];
    } else if (this.tableName === 'production_pools') {
      list = [...mockStore.production_pools];
    } else if (this.tableName === 'orders') {
      list = [...mockStore.orders];
    } else if (this.tableName === 'dispute_tickets') {
      list = [...mockStore.dispute_tickets];
    } else if (this.tableName === 'users') {
      list = [...mockStore.users];
    } else if (this.tableName === 'platform_settings') {
      list = [mockStore.platform_settings];
    } else if (this.tableName === 'compliance_profiles') {
      list = Object.values(mockStore.compliance_profiles);
    } else if (this.tableName === 'audit_log') {
      list = [...mockStore.audit_log];
    } else if (Array.isArray(mockStore[tableKey])) {
      list = [...(mockStore[tableKey] as any[])];
    }

    if (this.action === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: any[] = [];
      for (const row of rows) {
        const item = {
          id: row.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: new Date().toISOString(),
          ...row,
        };
        if (this.tableName === 'company_brands') {
          const combo = mockStore.combinations.find((c) => c.id === item.combination_id);
          if (combo) item.formulation_combinations = { display_composition: combo.display_composition };
          mockStore.company_brands.unshift(item);
        } else if (this.tableName === 'stockist_marketplace') {
          const brand = mockStore.company_brands.find((b) => b.id === item.brand_id);
          item.brand_name = brand?.brand_name || 'Brand';
          item.display_composition = brand?.formulation_combinations?.display_composition || 'Medicine';
          item.company_brands = {
            brand_name: item.brand_name,
            combination_id: brand?.combination_id || '',
            formulation_combinations: { display_composition: item.display_composition },
          };
          mockStore.stockist_marketplace.unshift(item);
        } else if (this.tableName === 'manufacturer_catalog') {
          const combo = mockStore.combinations.find((c) => c.id === item.combination_id);
          if (combo) item.formulation_combinations = { display_composition: combo.display_composition };
          mockStore.manufacturer_catalog.unshift(item);
        } else if (this.tableName === 'audit_log') {
          mockStore.audit_log.unshift(item);
        } else if (this.tableName === 'users') {
          mockStore.users.push(item);
        }
        inserted.push(item);
      }
      return { data: this.isSingle ? inserted[0] : inserted, error: null };
    }

    // Apply filters
    for (const filter of this.filters) {
      list = list.filter(filter);
    }

    if (this.action === 'update') {
      for (const item of list) {
        Object.assign(item, this.payload);
      }
      return { data: this.isSingle ? list[0] : list, error: null };
    }

    if (this.sortFn) {
      list.sort(this.sortFn);
    }

    if (this.limitCount != null) {
      list = list.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: list[0] ?? null, error: null };
    }

    return { data: list, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

// ============================================================
// Mock Supabase Client API
// ============================================================

const authStateListeners: ((event: string, session: any) => void)[] = [];

export const mockSupabase = {
  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  },

  auth: {
    async getSession() {
      const user = mockStore.currentUser;
      return {
        data: {
          session: user
            ? {
                user: { id: user.auth_user_id, email: user.email },
                access_token: 'mock-token',
              }
            : null,
        },
        error: null,
      };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authStateListeners.push(callback);
      // Fire initial state
      const user = mockStore.currentUser;
      const session = user ? { user: { id: user.auth_user_id, email: user.email } } : null;
      setTimeout(() => callback('INITIAL_SESSION', session), 0);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = authStateListeners.indexOf(callback);
              if (idx >= 0) authStateListeners.splice(idx, 1);
            },
          },
        },
      };
    },

    async signInWithOtp({ phone }: { phone: string }) {
      return { data: {}, error: null };
    },

    async signUp({ phone, email }: { phone?: string; email?: string }) {
      return { data: { user: { id: `auth-usr-${Date.now()}`, phone, email } }, error: null };
    },

    async verifyOtp({ phone, token }: { phone: string; token: string }) {
      // Find or create user
      let matched = mockStore.users.find((u) => u.phone_number === phone);
      if (!matched) {
        matched = {
          id: `u-${Date.now()}`,
          auth_user_id: `auth-${Date.now()}`,
          role: 'STOCKIST',
          phone_number: phone,
          email: null,
          display_name: phone,
          preferred_language: 'en',
          is_active: true,
          created_at: new Date().toISOString(),
        };
        mockStore.users.push(matched);
      }
      await mockStore.setCurrentUser(matched);
      for (const l of authStateListeners) {
        l('SIGNED_IN', { user: { id: matched.auth_user_id } });
      }
      return { data: { user: { id: matched.auth_user_id } }, error: null };
    },

    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      // Test accounts match
      const lower = email.toLowerCase().trim();
      let matched = mockStore.users.find((u) => u.email?.toLowerCase() === lower);
      if (!matched) {
        // Fallback default stockist
        matched = MOCK_USERS.stockist;
      }
      await mockStore.setCurrentUser(matched);
      for (const l of authStateListeners) {
        l('SIGNED_IN', { user: { id: matched.auth_user_id } });
      }
      return { data: { user: { id: matched.auth_user_id } }, error: null };
    },

    async signOut() {
      await mockStore.setCurrentUser(null);
      for (const l of authStateListeners) {
        l('SIGNED_OUT', null);
      }
      return { error: null };
    },

    async getUser() {
      const user = mockStore.currentUser;
      return { data: { user: user ? { id: user.auth_user_id, email: user.email } : null }, error: null };
    },
  },

  storage: {
    from(_bucket: string) {
      return {
        async upload(filePath: string, _blob: any) {
          return { data: { path: filePath }, error: null };
        },
      };
    },
  },

  channel(_name: string) {
    const ch = {
      on(_event: string, _filter: any, _callback: (payload: any) => void) {
        return ch;
      },
      subscribe(statusCb?: (status: string) => void) {
        if (statusCb) setTimeout(() => statusCb('SUBSCRIBED'), 100);
        return ch;
      },
    };
    return ch;
  },

  removeChannel(_channel: any) {
    return Promise.resolve();
  },
};

// ============================================================
// Mock Edge Functions
// ============================================================

export async function mockEdgeFunctions<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  if (functionName === 'search-molecule') {
    const query = String(body.query || '').toLowerCase();
    const matchedCombos = mockStore.combinations.filter(
      (c) => c.display_composition.toLowerCase().includes(query) || c.combination_hash.toLowerCase().includes(query)
    );

    const combinations: SearchCombinationResult[] = matchedCombos.map((c) => {
      const offers = mockStore.stockist_marketplace
        .filter((m) => m.company_brands?.combination_id === c.id && m.available_stock_units > 0)
        .map((m) => ({
          brand_id: m.brand_id,
          brand_name: m.brand_name || 'Brand',
          company_id: m.company_id,
          price_per_unit: m.wholesale_price_per_unit,
          available_stock: m.available_stock_units,
          trade_scheme: m.trade_scheme,
        }));

      return {
        combination_id: c.id,
        display_composition: c.display_composition,
        offers,
      };
    });

    return { combinations } as T;
  }

  if (functionName === 'basket-scan-match') {
    const lines = (body.ocr_extracted_lines as string[]) || [];
    const matches: BasketScanMatch[] = lines.map((line) => {
      const lower = line.toLowerCase();
      const combo = mockStore.combinations.find(
        (c) =>
          lower.includes(c.display_composition.toLowerCase().split(' ')[0]) ||
          lower.includes(c.combination_hash.toLowerCase())
      );
      return {
        input_line: line,
        candidate_combination_id: combo ? combo.id : mockStore.combinations[0].id,
        confidence: combo ? 0.95 : 0.75,
      };
    });
    return { matches } as T;
  }

  if (functionName === 'checkout-basket') {
    const items = (body.items as { marketplace_listing_id: string; quantity: number }[]) || [];
    const createdOrders: any[] = [];

    for (const item of items) {
      const listing = mockStore.stockist_marketplace.find((m) => m.id === item.marketplace_listing_id);
      if (listing) {
        listing.available_stock_units = Math.max(0, listing.available_stock_units - item.quantity);
        const grossValue = listing.wholesale_price_per_unit * item.quantity;
        const newOrder: any = {
          id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          layer: 'COMPANY_TO_STOCKIST',
          buyer_id: mockStore.currentUser?.id || 'u-stock-001',
          seller_id: listing.company_id,
          marketplace_listing_id: listing.id,
          pool_contribution_id: null,
          quantity: item.quantity,
          gross_invoice_value: grossValue,
          platform_fee_pct: 1.5,
          platform_fee_value: grossValue * 0.015,
          cash_velocity_discount_pct: 2.0,
          net_seller_payout: grossValue * 0.965,
          payment_channel: (body.payment_channel as any) || 'MANUAL_CONFIRMATION',
          declared_batch_number: listing.batch_number,
          scanned_batch_number: null,
          delivery_lat: (body.delivery_lat as number) || 12.9716,
          delivery_lng: (body.delivery_lng as number) || 77.5946,
          state: 'DELIVERED_PENDING_SCAN',
          escrow_provider_ref: `upi_ref_${Date.now()}`,
          created_at: new Date().toISOString(),
          settled_at: null,
          buyer: { display_name: mockStore.currentUser?.display_name || 'Stockist User', role: 'STOCKIST' },
          seller: { display_name: 'MedLife Therapeutics Pvt Ltd', role: 'PHARMA_COMPANY' },
        };
        mockStore.orders.unshift(newOrder);
        createdOrders.push({
          order_id: newOrder.id,
          escrow_provider_ref: newOrder.escrow_provider_ref,
          net_seller_payout: newOrder.net_seller_payout,
          gross_invoice_value: newOrder.gross_invoice_value,
        });
      }
    }

    const res: CheckoutResponse = { orders: createdOrders };
    return res as T;
  }

  if (functionName === 'confirm-batch-delivery') {
    const orderId = body.order_id as string;
    const scanned = body.scanned_batch_number as string;
    const order = mockStore.orders.find((o) => o.id === orderId);
    if (order) {
      order.scanned_batch_number = scanned;
      order.state = 'DELIVERED_CONFIRMED';
      order.settled_at = new Date().toISOString();
    }
    const res: BatchDeliveryResult = { state: 'DELIVERED_CONFIRMED', dispute_ticket_id: null };
    return res as T;
  }

  if (functionName === 'production-pool/contribute') {
    const pool = mockStore.production_pools[0];
    const qty = (body.requested_quantity as number) || 10000;
    if (pool) {
      pool.accumulated_quantity += qty;
      if (pool.accumulated_quantity >= pool.target_quantity) {
        pool.status = 'locked';
        pool.locked_at = new Date().toISOString();
      }
    }
    const res: PoolContributionResult = {
      pool_id: pool?.id || 'pool-001',
      pool_status: (pool?.status as any) || 'open',
      accumulated_quantity: pool?.accumulated_quantity || 50000,
      target_quantity: pool?.target_quantity || 50000,
    };
    return res as T;
  }

  if (functionName === 'pool-dispatch') {
    const poolId = body.pool_id as string;
    const pool = mockStore.production_pools.find((p) => p.id === poolId);
    if (pool) {
      pool.status = 'in_production';
    }
    const res: MockPoolDispatchResult = {
      created: [{ order_id: `ord-mfg-${Date.now()}`, company_id: 'u-comp-001' }],
      skipped: [],
      pool_status: 'in_production',
    };
    return res as T;
  }

  if (functionName === 'admin') {
    const action = body.action as string;
    if (action === 'update-settings') {
      Object.assign(mockStore.platform_settings, body);
      return mockStore.platform_settings as T;
    }
    if (action === 'resolve-dispute') {
      const ticketId = body.dispute_ticket_id as string;
      const resolution = body.resolution as any;
      const ticket = mockStore.dispute_tickets.find((d) => d.id === ticketId);
      if (ticket) {
        ticket.resolution = resolution;
        ticket.resolved_at = new Date().toISOString();
        ticket.resolved_by = mockStore.currentUser?.id || 'u-admin-001';
      }
      return { success: true } as T;
    }
  }

  if (functionName === 'onboard-compliance') {
    const userId = mockStore.currentUser?.id || 'u-user-001';
    mockStore.compliance_profiles[userId] = {
      id: `cp-${Date.now()}`,
      user_id: userId,
      legal_entity_name: body.legal_entity_name || 'Registered Entity',
      gstin: body.gstin || '29ABCDE1234F1Z5',
      drug_license_number: body.drug_license_number || 'DL-2026',
      drug_license_expiry: '2028-12-31',
      who_gmp_certified: true,
      verification_status: 'verified',
    };
    return { success: true, verified: true } as T;
  }

  return { success: true } as T;
}

// Active demo status
let demoModeActive = Config.supabase.demoMode ?? true;

export const isDemoActive = () => demoModeActive;
export const setDemoActive = (active: boolean) => {
  demoModeActive = active;
};
