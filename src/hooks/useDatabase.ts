import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase, callEdgeFunction } from '../lib/supabase';
import { useAuthContext } from '../config/providers';
import type {
 StockistMarketplace,
 SearchCombinationResult,
 PlatformSettings,
 BatchDeliveryResult,
 CheckoutResponse,
 PoolContributionResult,
} from '../lib/types';

// ============================================================
// Fix #4: Properly typed admin stats interface
// ============================================================

export interface AdminStats {
 totalGMV: number;
 activeUsers: number;
 pendingDisputes: number;
 usersByRole: Record<string, number>;
}

export interface OrderRow {
 id: string;
 gross_invoice_value: string | number;
 state: string;
}

export interface UserRow {
 id: string;
 role: string;
 is_active: boolean;
}

export interface DisputeRow {
 id: string;
 resolution: string;
}

// ============================================================
// Combinations Lookup (for brand registration)
// ============================================================

export function useCombinations() {
 return useQuery({
 queryKey: ['combinations'],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('formulation_combinations')
 .select('id, display_composition')
 .order('display_composition');
 if (error) throw error;
 return data as { id: string; display_composition: string }[];
 },
 staleTime: 60_000,
 });
}

// ============================================================
// Search Hooks (04-API-SPEC.md §2.2)
// ============================================================

export function useMoleculeSearch(query: string, enabled = true) {
 return useQuery({
 queryKey: ['search', 'molecule', query],
 queryFn: async () => {
 if (!query || query.length < 2) return { combinations: [] };
 return callEdgeFunction<{ combinations: SearchCombinationResult[] }>(
 'search-molecule',
 { query, language: 'en' }
 );
 },
 enabled: enabled && query.length >= 2,
 staleTime: 30_000,
 });
}

// ============================================================
// Marketplace Hooks (Stockist browsing, SRS §3.4-3.5)
// ============================================================

export function useMarketplaceListings(combinationId?: string) {
 return useQuery({
 queryKey: ['marketplace', combinationId],
 queryFn: async () => {
 // FK path: stockist_marketplace → company_brands → formulation_combinations.
 // PostgREST requires the FULL relationship path for nested embeds.
 let query = supabase
 .from('stockist_marketplace')
 .select(`
 *,
 company_brands!inner(
 brand_name,
 combination_id,
 formulation_combinations!inner(display_composition)
 )
 `)
 .gt('available_stock_units', 0)
 .order('wholesale_price_per_unit', { ascending: true });

 if (combinationId) {
 query = query.eq('company_brands.combination_id', combinationId);
 }

 const { data, error } = await query;
 if (error) throw error;
 return data as (StockistMarketplace & {
 company_brands: {
 brand_name: string;
 combination_id: string;
 formulation_combinations: { display_composition: string };
 };
 })[];
 },
 staleTime: 15_000,
 });
}

// ============================================================
// Basket Scan Match (04-API-SPEC.md §2.3)
// ============================================================

export interface BasketScanMatch {
 input_line: string;
 candidate_combination_id: string | null;
 confidence: number;
}

export function useBasketScanMatch() {
 return useMutation({
 mutationFn: async (ocrLines: string[]) => {
 return callEdgeFunction<{ matches: BasketScanMatch[] }>(
 'basket-scan-match',
 { ocr_extracted_lines: ocrLines }
 );
 },
 });
}

// ============================================================
// Order Hooks
// ============================================================

export function useMyOrders(userId?: string) {
 return useQuery({
 queryKey: ['orders', userId],
 queryFn: async () => {
 if (!userId) return [];
 const { data, error } = await supabase
 .from('orders')
 .select(`
 *,
 buyer:users!orders_buyer_id_fkey(display_name, role),
 seller:users!orders_seller_id_fkey(display_name, role)
 `)
 .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
 .order('created_at', { ascending: false });
 if (error) throw error;
 return data;
 },
 enabled: !!userId,
 staleTime: 10_000,
 });
}

export function useOrderDetail(orderId?: string) {
 return useQuery({
 queryKey: ['order', orderId],
 queryFn: async () => {
 if (!orderId) return null;
 const { data, error } = await supabase
 .from('orders')
 .select(`
 *,
 buyer:users!orders_buyer_id_fkey(display_name, role),
 seller:users!orders_seller_id_fkey(display_name, role)
 `)
 .eq('id', orderId)
 .single();
 if (error) throw error;
 return data;
 },
 enabled: !!orderId,
 });
}

// ============================================================
// Checkout & Delivery (Edge Functions)
// ============================================================

export function useCheckout() {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: async (input: {
 items: { marketplace_listing_id: string; quantity: number }[];
 payment_channel: string;
 delivery_lat: number;
 delivery_lng: number;
 idempotency_key?: string;
 }) => {
 return callEdgeFunction<CheckoutResponse>('checkout-basket', input);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['orders'] });
 queryClient.invalidateQueries({ queryKey: ['marketplace'] });
 queryClient.invalidateQueries({ queryKey: ['basket'] });
 },
 });
}

export function useConfirmBatchDelivery() {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: async (input: { order_id: string; scanned_batch_number: string }) => {
 return callEdgeFunction<BatchDeliveryResult>('confirm-batch-delivery', input);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['orders'] });
 },
 });
}

// ============================================================
// Basket (Local state with offline queue)
// ============================================================

export interface BasketItem {
 id: string;
 listingId: string;
 brandName: string;
 composition: string;
 pricePerUnit: number;
 quantity: number;
 availableStock: number;
 tradeScheme: { buy: number; get_free: number } | null;
}

let basketState: BasketItem[] = [];
let basketLoadedForUser: string | null = null;

const getBasketKey = (userId: string) => `@pharmaos_basket_${userId}`;

const persistBasket = async (items: BasketItem[], userId: string) => {
 try {
 await AsyncStorage.setItem(getBasketKey(userId), JSON.stringify(items));
 } catch { /* offline persistence best-effort */ }
};

const loadBasket = async (userId: string): Promise<BasketItem[]> => {
 try {
 const raw = await AsyncStorage.getItem(getBasketKey(userId));
 return raw ? JSON.parse(raw) : [];
 } catch { return []; }
};

export function useBasket() {
 const queryClient = useQueryClient();
 const { user } = useAuthContext();
 const userId = user?.id || 'anon';

 // Reactive subscription (C-FE1 fix): every useBasket() consumer observes
 // ['basket'] via useQuery, so setQueryData mutations re-render all of them.
 // The queryFn returns the module-level basketState — the store of truth is
 // the module + AsyncStorage, React Query is the reactive notification layer.
 const basketQuery = useQuery<BasketItem[]>({
 queryKey: ['basket'],
 queryFn: () => [...basketState],
 staleTime: Infinity,
 });

 // Restore basket from AsyncStorage per user (SRS §4 offline resilience).
 // Closure guard (C-FE3 fix): a slow load for a previous user can never
 // overwrite the current user's basket.
 useEffect(() => {
 if (basketLoadedForUser === userId) return;
 basketLoadedForUser = userId;
 loadBasket(userId).then((items) => {
 if (basketLoadedForUser !== userId) return;
 basketState = items;
 queryClient.setQueryData(['basket'], [...basketState]);
 });
 }, [userId, queryClient]);

 // Offline → online revalidation (F15 / TC-10): on reconnect, basket items
 // are re-checked against live marketplace stock — depleted items are
 // removed, stale stock counts refreshed. Composition is offline-safe via
 // AsyncStorage; checkout itself always requires the server (§25).
 useEffect(() => {
 const unsub = NetInfo.addEventListener((state: any) => {
 if (!state.isConnected) return;
 const current = basketState;
 if (current.length === 0) return;
 (async () => {
 try {
 const ids = current.map((i) => i.listingId);
 const { data, error } = await supabase
 .from('stockist_marketplace')
 .select('id, available_stock_units')
 .in('id', ids);
 if (error) return;
 const stockById = new Map((data ?? []).map((r: any) => [r.id, r.available_stock_units]));
 const next = current
 .map((i) => ({ ...i, availableStock: stockById.get(i.listingId) ?? i.availableStock }))
 .filter((i) => (stockById.get(i.listingId) ?? 0) >= i.quantity);
 basketState = next;
 queryClient.setQueryData(['basket'], [...basketState]);
 await persistBasket(next, userId);
 } catch {
 // still offline or query failed — basket stays as-is locally
 }
 })();
 });
 return () => unsub();
 }, [userId, queryClient]);

 const addItem = (item: Omit<BasketItem, 'id'>) => {
 const existing = basketState.find((i) => i.listingId === item.listingId);
 if (existing) {
 basketState = basketState.map((i) =>
 i.listingId === item.listingId ? { ...i, quantity: i.quantity + item.quantity } : i
 );
 } else {
 basketState = [...basketState, { ...item, id: item.listingId }];
 }
 queryClient.setQueryData(['basket'], [...basketState]);
 persistBasket(basketState, userId);
 };

 const removeItem = (listingId: string) => {
 basketState = basketState.filter((i) => i.listingId !== listingId);
 queryClient.setQueryData(['basket'], [...basketState]);
 persistBasket(basketState, userId);
 };

 const updateQuantity = (listingId: string, quantity: number) => {
 basketState = basketState.map((i) =>
 i.listingId === listingId ? { ...i, quantity } : i
 );
 queryClient.setQueryData(['basket'], [...basketState]);
 persistBasket(basketState, userId);
 };

 const clearBasket = () => {
 basketState = [];
 queryClient.setQueryData(['basket'], []);
 persistBasket([], userId);
 };

 const getSubtotal = () =>
 basketState.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);

 const getItemCount = () =>
 basketState.reduce((sum, item) => sum + item.quantity, 0);

 return {
 items: basketQuery.data ?? basketState,
 addItem,
 removeItem,
 updateQuantity,
 clearBasket,
 getSubtotal,
 getItemCount,
 };
}

// ============================================================
// Company Brand Hooks
// ============================================================

export function useCompanyBrands(companyId?: string) {
 return useQuery({
 queryKey: ['brands', companyId],
 queryFn: async () => {
 if (!companyId) return [];
 const { data, error } = await supabase
 .from('company_brands')
 .select(`*, formulation_combinations(display_composition)`)
 .eq('company_id', companyId)
 .order('created_at', { ascending: false });
 if (error) throw error;
 return data;
 },
 enabled: !!companyId,
 });
}

export function useRegisterBrand() {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: async (input: {
 company_id: string;
 combination_id: string;
 brand_name: string;
 trademark_doc_storage_path: string;
 }) => {
 const { data, error } = await supabase
 .from('company_brands')
 .insert(input)
 .select()
 .single();
 if (error) throw error;
 return data;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['brands'] });
 },
 });
}

// ============================================================
// Production Pool (04-API-SPEC.md §2.8)
// ============================================================

export function useJoinPool() {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: async (input: {
 manufacturer_catalog_id: string;
 requested_quantity: number;
 intended_brand_name: string;
 packaging_spec: Record<string, unknown> | null;
 agreed_unit_cost: number;
 }) => {
 return callEdgeFunction<PoolContributionResult>('production-pool/contribute', input);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['pools'] });
 },
 });
}

// ============================================================
// Admin Hooks
// ============================================================

export function usePlatformSettings() {
 return useQuery({
 queryKey: ['platform-settings'],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('platform_settings').select('*').eq('id', 1).single();
 if (error) throw error;
 return data as PlatformSettings;
 },
 });
}

export function useUpdatePlatformSettings() {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: async (input: Partial<PlatformSettings>) => {
 return callEdgeFunction<PlatformSettings>('admin', { action: 'update-settings', ...input });
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
 },
 });
}

export function useDisputes() {
 return useQuery({
 queryKey: ['disputes'],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('dispute_tickets')
 .select(`
 *,
 order:orders(quantity, gross_invoice_value, declared_batch_number, scanned_batch_number),
 raiser:users!dispute_tickets_raised_by_fkey(display_name),
 resolver:users!dispute_tickets_resolved_by_fkey(display_name)
 `)
 .order('created_at', { ascending: false });
 if (error) throw error;
 return data;
 },
 });
}

export function useResolveDispute() {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: async (input: {
 dispute_ticket_id: string;
 resolution: 'RELEASED_TO_SELLER' | 'REFUNDED_TO_BUYER';
 }) => {
 return callEdgeFunction<{ success: boolean }>('admin', { action: 'resolve-dispute', ...input });
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['disputes'] });
 queryClient.invalidateQueries({ queryKey: ['orders'] });
 },
 });
}

// ============================================================
// Manufacturer Catalog
// ============================================================

export function useManufacturerCatalog(manufacturerId?: string) {
 return useQuery({
 queryKey: ['manufacturer-catalog', manufacturerId],
 queryFn: async () => {
 if (!manufacturerId) return [];
 const { data, error } = await supabase
 .from('manufacturer_catalog')
 .select(`*, formulation_combinations(display_composition)`)
 .eq('manufacturer_id', manufacturerId)
 .eq('is_active', true)
 .order('factory_gate_unit_cost', { ascending: true });
 if (error) throw error;
 return data;
 },
 enabled: !!manufacturerId,
 });
}

export function useActivePools(manufacturerId?: string) {
 return useQuery({
 queryKey: ['pools', manufacturerId],
 queryFn: async () => {
 if (!manufacturerId) return [];
 const { data, error } = await supabase
 .from('production_pools')
 .select(`*, manufacturer_catalog!inner(manufacturer_id)`)
 .eq('manufacturer_catalog.manufacturer_id', manufacturerId)
 .in('status', ['open', 'locked', 'in_production']);
 if (error) throw error;
 return data;
 },
 enabled: !!manufacturerId,
 });
}

// ============================================================
// Pool dispatch (master doc §6.1): manufacturer ships a locked pool —
// one MFG_TO_COMPANY order per contribution, server-derived economics.
// ============================================================
export interface PoolDispatchResult {
 created: { order_id: string; company_id: string }[];
 skipped: { contribution_id: string; reason: string }[];
 pool_status: string;
}

export function usePoolDispatch() {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: async (input: { pool_id: string }) => {
 return callEdgeFunction<PoolDispatchResult>('pool-dispatch', input);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['pools'] });
 queryClient.invalidateQueries({ queryKey: ['orders'] });
 queryClient.invalidateQueries({ queryKey: ['pool-contributions'] });
 },
 });
}

// ============================================================
// Fix #4: Admin Dashboard Stats — properly typed
// ============================================================

export function useAdminStats() {
 return useQuery<AdminStats>({
 queryKey: ['admin-stats'],
 queryFn: async () => {
 const [ordersResult, usersResult, disputesResult] = await Promise.all([
 supabase.from('orders').select('id, gross_invoice_value, state'),
 supabase.from('users').select('id, role, is_active'),
 supabase.from('dispute_tickets').select('id, resolution'),
 ]);

 const orders = (ordersResult.data || []) as OrderRow[];
 const users = (usersResult.data || []) as UserRow[];
 const disputes = (disputesResult.data || []) as DisputeRow[];

 const totalGMV = orders.reduce(
 (sum, o) => sum + Number(o.gross_invoice_value), 0
 );

 const activeUsers = users.filter((u) => u.is_active).length;

 const pendingDisputes = disputes.filter((d) => d.resolution === 'PENDING').length;

 const usersByRole: Record<string, number> = {};
 for (const u of users) {
 usersByRole[u.role] = (usersByRole[u.role] || 0) + 1;
 }

 return { totalGMV, activeUsers, pendingDisputes, usersByRole };
 },
 staleTime: 30_000,
 });
}
