import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PAIRING_KEY = "calculator_pairing_data";

export interface PairingData {
  code: string;
  role: "A" | "B";
}

// ============================================
// SECURE STORAGE
// Uses Android Keystore via expo-secure-store on native
// Falls back to AsyncStorage on web (for testing only)
// Stores the pairing data permanently after first unlock
// ============================================

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function savePairing(pairing: PairingData): Promise<void> {
  await setItem(PAIRING_KEY, JSON.stringify(pairing));
}

export async function getPairing(): Promise<PairingData | null> {
  try {
    const data = await getItem(PAIRING_KEY);
    if (data) {
      return JSON.parse(data) as PairingData;
    }
    return null;
  } catch {
    return null;
  }
}

export async function hasPairing(): Promise<boolean> {
  const pairing = await getPairing();
  return pairing !== null;
}

export async function clearPairing(): Promise<void> {
  await deleteItem(PAIRING_KEY);
}
