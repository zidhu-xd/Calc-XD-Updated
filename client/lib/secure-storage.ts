import * as SecureStore from "expo-secure-store";

const PAIRING_KEY = "calculator_pairing_data";

export interface PairingData {
  code: string;
  role: "A" | "B";
}

// ============================================
// SECURE STORAGE - Uses Android Keystore via expo-secure-store
// Stores the pairing data permanently after first unlock
// ============================================

export async function savePairing(pairing: PairingData): Promise<void> {
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(pairing));
}

export async function getPairing(): Promise<PairingData | null> {
  const data = await SecureStore.getItemAsync(PAIRING_KEY);
  if (data) {
    return JSON.parse(data) as PairingData;
  }
  return null;
}

export async function hasPairing(): Promise<boolean> {
  const pairing = await getPairing();
  return pairing !== null;
}

export async function clearPairing(): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY);
}
