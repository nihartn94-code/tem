import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders } from './src/config/providers';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ui/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProviders>
          <AppNavigator />
          <StatusBar style="auto" />
        </AppProviders>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
