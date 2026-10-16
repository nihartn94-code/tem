import {
  PhoneSchema,
  OTPSchema,
  GSTINSchema,
  DrugLicenseSchema,
  SearchQuerySchema,
  CheckoutSchema,
  BatchDeliverySchema,
  BrandRegistrationSchema,
  MarketplaceListingSchema,
} from '../src/lib/validation';

describe('Validation Schemas', () => {
  describe('PhoneSchema', () => {
    it('should accept valid 10-digit phone', () => {
      expect(() => PhoneSchema.parse({ phone: '9876543210' })).not.toThrow();
    });

    it('should accept E.164 format', () => {
      expect(() => PhoneSchema.parse({ phone: '+919876543210' })).not.toThrow();
    });

    it('should reject too short phone', () => {
      expect(() => PhoneSchema.parse({ phone: '123' })).toThrow();
    });

    it('should reject non-numeric phone', () => {
      expect(() => PhoneSchema.parse({ phone: 'abcdefghij' })).toThrow();
    });
  });

  describe('OTPSchema', () => {
    it('should accept 6-digit OTP', () => {
      expect(() => OTPSchema.parse({ otp: '123456' })).not.toThrow();
    });

    it('should reject 5-digit OTP', () => {
      expect(() => OTPSchema.parse({ otp: '12345' })).toThrow();
    });

    it('should reject 7-digit OTP', () => {
      expect(() => OTPSchema.parse({ otp: '1234567' })).toThrow();
    });
  });

  describe('GSTINSchema', () => {
    it('should accept valid GSTIN format', () => {
      expect(() => GSTINSchema.parse('22AAAAA0000A1Z5')).not.toThrow();
    });

    it('should reject invalid GSTIN format', () => {
      expect(() => GSTINSchema.parse('INVALID')).toThrow();
    });

    it('should reject GSTIN with wrong structure', () => {
      expect(() => GSTINSchema.parse('22AAAAA0000A1Z')).toThrow();
    });
  });

  describe('DrugLicenseSchema', () => {
    it('should accept valid compliance data', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const data = {
        legal_entity_name: 'ABC Pharma Pvt Ltd',
        gstin: '22AAAAA0000A1Z5',
        drug_license_number: 'DL-001',
        drug_license_expiry: futureDate.toISOString().split('T')[0],
        who_gmp_certified: false,
        facility_lat: 28.6139,
        facility_lng: 77.2090,
      };
      expect(() => DrugLicenseSchema.parse(data)).not.toThrow();
    });

    it('should reject past expiry date', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const data = {
        legal_entity_name: 'ABC Pharma',
        gstin: '22AAAAA0000A1Z5',
        drug_license_number: 'DL-001',
        drug_license_expiry: pastDate.toISOString().split('T')[0],
        who_gmp_certified: false,
        facility_lat: 28.6139,
        facility_lng: 77.2090,
      };
      expect(() => DrugLicenseSchema.parse(data)).toThrow();
    });

    it('should reject invalid latitude', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const data = {
        legal_entity_name: 'ABC Pharma',
        gstin: '22AAAAA0000A1Z5',
        drug_license_number: 'DL-001',
        drug_license_expiry: futureDate.toISOString().split('T')[0],
        who_gmp_certified: false,
        facility_lat: 999, // invalid
        facility_lng: 77.2090,
      };
      expect(() => DrugLicenseSchema.parse(data)).toThrow();
    });
  });

  describe('SearchQuerySchema', () => {
    it('should accept valid search query', () => {
      expect(() => SearchQuerySchema.parse({ query: 'metformin', language: 'en' })).not.toThrow();
    });

    it('should default language to en', () => {
      const result = SearchQuerySchema.parse({ query: 'metformin' });
      expect(result.language).toBe('en');
    });

    it('should reject empty query', () => {
      expect(() => SearchQuerySchema.parse({ query: '' })).toThrow();
    });
  });

  describe('CheckoutSchema', () => {
    it('should accept valid checkout data', () => {
      const data = {
        items: [{ marketplace_listing_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 5 }],
        payment_channel: 'ESCROW_INSTANT',
        delivery_lat: 28.6139,
        delivery_lng: 77.2090,
      };
      expect(() => CheckoutSchema.parse(data)).not.toThrow();
    });

    it('should reject empty items', () => {
      const data = {
        items: [],
        payment_channel: 'ESCROW_INSTANT',
        delivery_lat: 28.6139,
        delivery_lng: 77.2090,
      };
      expect(() => CheckoutSchema.parse(data)).toThrow();
    });

    it('should reject zero quantity', () => {
      const data = {
        items: [{ marketplace_listing_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 0 }],
        payment_channel: 'ESCROW_INSTANT',
        delivery_lat: 28.6139,
        delivery_lng: 77.2090,
      };
      expect(() => CheckoutSchema.parse(data)).toThrow();
    });

    it('should reject negative quantity', () => {
      const data = {
        items: [{ marketplace_listing_id: '123e4567-e89b-12d3-a456-426614174000', quantity: -1 }],
        payment_channel: 'ESCROW_INSTANT',
        delivery_lat: 28.6139,
        delivery_lng: 77.2090,
      };
      expect(() => CheckoutSchema.parse(data)).toThrow();
    });
  });

  describe('BatchDeliverySchema', () => {
    it('should accept valid batch delivery data', () => {
      const data = {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        scanned_batch_number: 'BATCH2026A',
      };
      expect(() => BatchDeliverySchema.parse(data)).not.toThrow();
    });

    it('should reject empty batch number', () => {
      const data = {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        scanned_batch_number: '',
      };
      expect(() => BatchDeliverySchema.parse(data)).toThrow();
    });
  });

  describe('BrandRegistrationSchema', () => {
    it('should accept valid brand data', () => {
      const data = {
        combination_id: '123e4567-e89b-12d3-a456-426614174000',
        brand_name: 'Glycomet-GP',
        trademark_doc_storage_path: 'documents/trademark.pdf',
      };
      expect(() => BrandRegistrationSchema.parse(data)).not.toThrow();
    });

    it('should reject missing trademark doc', () => {
      const data = {
        combination_id: '123e4567-e89b-12d3-a456-426614174000',
        brand_name: 'Glycomet-GP',
        trademark_doc_storage_path: '',
      };
      expect(() => BrandRegistrationSchema.parse(data)).toThrow();
    });
  });

  describe('MarketplaceListingSchema', () => {
    it('should accept valid listing with trade scheme', () => {
      const data = {
        brand_id: '123e4567-e89b-12d3-a456-426614174000',
        batch_number: 'BATCH2026A',
        expiry_date: '2027-12-31',
        wholesale_price_per_unit: 12.5,
        available_stock_units: 1000,
        trade_scheme: { buy: 10, get_free: 1 },
      };
      expect(() => MarketplaceListingSchema.parse(data)).not.toThrow();
    });

    it('should accept listing without trade scheme', () => {
      const data = {
        brand_id: '123e4567-e89b-12d3-a456-426614174000',
        batch_number: 'BATCH2026A',
        expiry_date: '2027-12-31',
        wholesale_price_per_unit: 12.5,
        available_stock_units: 1000,
        trade_scheme: null,
      };
      expect(() => MarketplaceListingSchema.parse(data)).not.toThrow();
    });

    it('should reject negative stock', () => {
      const data = {
        brand_id: '123e4567-e89b-12d3-a456-426614174000',
        batch_number: 'BATCH2026A',
        expiry_date: '2027-12-31',
        wholesale_price_per_unit: 12.5,
        available_stock_units: -1,
        trade_scheme: null,
      };
      expect(() => MarketplaceListingSchema.parse(data)).toThrow();
    });

    it('should reject zero price', () => {
      const data = {
        brand_id: '123e4567-e89b-12d3-a456-426614174000',
        batch_number: 'BATCH2026A',
        expiry_date: '2027-12-31',
        wholesale_price_per_unit: 0,
        available_stock_units: 100,
        trade_scheme: null,
      };
      expect(() => MarketplaceListingSchema.parse(data)).toThrow();
    });
  });
});
