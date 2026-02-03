import React, { useEffect, useRef } from "react";
import { StyleSheet, AppState, AppStateStatus } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator, { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ============================================
  // AUTO-LOCK - Returns to calculator when app goes to background
  // ============================================
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current === "active" &&
      (nextAppState === "background" || nextAppState === "inactive")
    ) {
      // Navigate back to calculator to lock the app
      if (navigationRef.current) {
        const state = navigationRef.current.getRootState();
        if (state?.routes[state.index]?.name === "Chat") {
          navigationRef.current.navigate("Calculator");
        }
      }
    }
    appState.current = nextAppState;
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <NavigationContainer ref={navigationRef}>
                <RootStackNavigator />
              </NavigationContainer>
              <StatusBar style="light" />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
