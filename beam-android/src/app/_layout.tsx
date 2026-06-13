import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';

import { Colors } from '@/constants/theme';
import { ConnectionProvider } from '@/data/connection-context';
import { I18nProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <I18nProvider>
      <ConnectionProvider>
        <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.dark.background },
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
        <StatusBar style="light" />
      </ConnectionProvider>
    </I18nProvider>
  );
}
