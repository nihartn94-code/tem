import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthContext } from '../config/providers';
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { BasketScreen } from '../screens/BasketScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { BatchScanScreen } from '../screens/BatchScanScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { AdminBroadcastScreen } from '../screens/AdminBroadcastScreen';
import { AdminHealthDashboard } from '../screens/AdminHealthDashboard';
import { ManufacturerScreen } from '../screens/ManufacturerScreen';
import { CompanyScreen } from '../screens/CompanyScreen';
import { useColors, useShadows, type Palette } from '../config/theme';
import { PharmaIcon, AppIcons, type IconName } from '../components/ui/Icon';
import { useBasket } from '../hooks/useDatabase';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { BroadcastBanner } from '../components/ui/BroadcastBanner';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ============================================================
// Tab ParamList
// ============================================================

export type TabParamList = {
 Home: undefined;
 Marketplace: undefined;
 Basket: undefined;
 Orders: undefined;
 Profile: undefined;
 Brands: undefined;
 Catalog: undefined;
 Admin: undefined;
};

// ============================================================
// Root Stack ParamList
// ============================================================

export type RootStackParamList = {
 Auth: undefined;
 Tabs: undefined;
 OrderDetail: { orderId: string };
 BatchScan: { orderId: string; declaredBatchNumber: string };
 Onboarding: undefined;
 Broadcast: undefined;
 HealthDashboard: undefined;
};

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type HomeScreenNavProp = CompositeNavigationProp<
 BottomTabNavigationProp<TabParamList, 'Home'>,
 NativeStackNavigationProp<RootStackParamList>
>;

export type TabScreenNavProp = BottomTabNavigationProp<TabParamList>;

// ============================================================
// Screen transition configuration
// ============================================================

const screenOptions = (colors: Palette) => ({
 headerShown: false,
 animation: 'slide_from_right' as const,
 contentStyle: { backgroundColor: colors.background },
});

const modalOptions = (colors: Palette) => ({
 headerShown: false,
 animation: 'slide_from_bottom' as const,
 presentation: 'modal' as const,
 contentStyle: { backgroundColor: colors.background },
});

// ============================================================
// Tab icon component — vector icons, not emoji
// ============================================================

function TabIcon({ icon, focused, color }: { icon: IconName; focused: boolean; color: string }) {
 return (
 <PharmaIcon
 name={icon}
 size={24}
 color={color}
 />
 );
}

// Basket icon with item count badge — restored after rebuild deleted it
function BasketTabIcon({ focused }: { focused: boolean }) {
 const { getItemCount } = useBasket();
 const count = getItemCount();
 const colors = useColors();
 const scheme = useColorScheme();
 const badge = scheme === 'dark' ? basketBadgeStylesDark : basketBadgeStylesLight;
 return (
 <View style={{ overflow: 'visible' }}>
 <PharmaIcon name={AppIcons.basket} size={24} color={focused ? colors.primary : colors.textTertiary} />
 {count > 0 && (
 <View style={badge.badge}>
 <Text style={badge.badgeText}>{count > 99 ? '99+' : count}</Text>
 </View>
 )}
 </View>
 );
}

const makeBasketBadgeStyles = (danger: string, surface: string, textInverse: string) => StyleSheet.create({
 badge: {
 position: 'absolute',
 top: -4,
 right: -8,
 minWidth: 18,
 height: 18,
 borderRadius: 9,
 backgroundColor: danger,
 alignItems: 'center',
 justifyContent: 'center',
 paddingHorizontal: 4,
 borderWidth: 2,
 borderColor: surface,
 },
 badgeText: {
 color: textInverse,
 fontSize: 10,
 fontWeight: '700',
 },
});
const basketBadgeStylesLight = makeBasketBadgeStyles('#C62828', '#FFFFFF', '#FFFFFF');
const basketBadgeStylesDark = makeBasketBadgeStyles('#EF5350', '#1A1D24', '#0F1117');

// ============================================================
// Tab Navigators (one per role) — with vector icons
// ============================================================

const tabScreenOptions = (colors: Palette, shadows: ReturnType<typeof useShadows>) => ({
 headerShown: false,
 tabBarActiveTintColor: colors.primary,
 tabBarInactiveTintColor: colors.textTertiary,
 tabBarStyle: {
 backgroundColor: colors.surface,
 borderTopColor: colors.borderLight,
 height: 60,
 paddingBottom: 8,
 paddingTop: 8,
 ...shadows.lg,
 },
 tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
});

function useTabScreenOptions() {
 return tabScreenOptions(useColors(), useShadows());
}

function StockistTabs() {
 return (
 <Tab.Navigator screenOptions={useTabScreenOptions()}>
 <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.home} focused={focused} color={color} /> }} />
 <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.marketplace} focused={focused} color={color} /> }} />
 <Tab.Screen name="Basket" component={BasketScreen} options={{ tabBarIcon: ({ focused }) => <BasketTabIcon focused={focused} /> }} />
 <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.orders} focused={focused} color={color} /> }} />
 <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.profile} focused={focused} color={color} /> }} />
 </Tab.Navigator>
 );
}

function CompanyTabs() {
 return (
 <Tab.Navigator screenOptions={useTabScreenOptions()}>
 <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.home} focused={focused} color={color} /> }} />
 <Tab.Screen name="Brands" component={CompanyScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.brands} focused={focused} color={color} /> }} />
 <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.orders} focused={focused} color={color} /> }} />
 <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.profile} focused={focused} color={color} /> }} />
 </Tab.Navigator>
 );
}

function ManufacturerTabs() {
 return (
 <Tab.Navigator screenOptions={useTabScreenOptions()}>
 <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.home} focused={focused} color={color} /> }} />
 <Tab.Screen name="Catalog" component={ManufacturerScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.catalog} focused={focused} color={color} /> }} />
 <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.orders} focused={focused} color={color} /> }} />
 <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.profile} focused={focused} color={color} /> }} />
 </Tab.Navigator>
 );
}

function AdminTabs() {
 return (
 <Tab.Navigator screenOptions={useTabScreenOptions()}>
 <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.home} focused={focused} color={color} /> }} />
 <Tab.Screen name="Admin" component={AdminScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.admin} focused={focused} color={color} /> }} />
 <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused, color }) => <TabIcon icon={AppIcons.profile} focused={focused} color={color} /> }} />
 </Tab.Navigator>
 );
}

// ============================================================
// Role-based Stack (tabs + detail screens) — with transitions
// ============================================================

function RoleStack() {
 const { user } = useAuthContext();
 useRealtimeSync(true);
 const colors = useColors();
 const role = user?.role || 'STOCKIST';
 const TabComponent =
 role === 'ADMIN' ? AdminTabs :
 role === 'MANUFACTURER' ? ManufacturerTabs :
 role === 'PHARMA_COMPANY' ? CompanyTabs :
 StockistTabs;

 return (
 <View style={{ flex: 1 }}>
 <BroadcastBanner />
 <Stack.Navigator screenOptions={screenOptions(colors)}>
 <Stack.Screen name="Tabs" component={TabComponent} />
 <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
 <Stack.Screen name="BatchScan" component={BatchScanScreen} />
 <Stack.Screen name="Onboarding" component={OnboardingScreen} options={modalOptions(colors)} />
 <Stack.Screen name="Broadcast" component={AdminBroadcastScreen} />
 <Stack.Screen name="HealthDashboard" component={AdminHealthDashboard} />
 </Stack.Navigator>
 </View>
 );
}

// ============================================================
// Root
// ============================================================

export function AppNavigator() {
 const { isAuthenticated } = useAuthContext();
 const colors = useColors();
 const scheme = useColorScheme();
 const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

 return (
 <NavigationContainer
 theme={{ ...navTheme, colors: { ...navTheme.colors, background: colors.background, card: colors.surface } }}
 >
 {isAuthenticated ? (
 <RoleStack />
 ) : (
 <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }}>
 <Stack.Screen name="Auth" component={AuthScreen} />
 </Stack.Navigator>
 )}
 </NavigationContainer>
 );
}


