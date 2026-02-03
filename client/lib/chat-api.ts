// ============================================
// CHAT API - All messaging uses https://zidhuxd.me/api
// No Firebase, Telegram, or external services
// ============================================

const API_BASE = "https://zidhuxd.me/api";
const PAIRING_URL = "https://www.zidhuxd.me/chat.json";

export interface Message {
  id: string;
  text: string;
  sender: "A" | "B";
  timestamp: number;
  read: boolean;
}

export interface TypingEvent {
  type: "typing";
  sender: "A" | "B";
  isTyping: boolean;
  timestamp: number;
}

export interface ReadReceiptEvent {
  type: "read_receipt";
  sender: "A" | "B";
  messageIds: string[];
  timestamp: number;
}

export interface PairingResponse {
  pairings: Array<{ code: string; role: "A" | "B" }>;
  bot_token?: string;
  group_chat_id?: string;
}

// ============================================
// PAIRING - Fetched from https://www.zidhuxd.me/chat.json
// ============================================
export async function fetchPairingData(): Promise<PairingResponse | null> {
  try {
    const response = await fetch(PAIRING_URL);
    if (!response.ok) {
      console.error("Failed to fetch pairing data:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching pairing data:", error);
    return null;
  }
}

export function findPairingByCode(
  data: PairingResponse,
  code: string
): { code: string; role: "A" | "B" } | null {
  return data.pairings.find((p) => p.code === code) || null;
}

// ============================================
// MESSAGING API - Uses https://zidhuxd.me/api
// ============================================

export async function sendMessage(
  role: "A" | "B",
  text: string
): Promise<Message | null> {
  try {
    const response = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: role,
        text,
        timestamp: Date.now(),
      }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
}

export async function fetchMessages(role: "A" | "B"): Promise<Message[]> {
  try {
    const response = await fetch(`${API_BASE}/messages?role=${role}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

export async function sendTypingEvent(
  role: "A" | "B",
  isTyping: boolean
): Promise<void> {
  try {
    await fetch(`${API_BASE}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "typing",
        sender: role,
        isTyping,
        timestamp: Date.now(),
      }),
    });
  } catch (error) {
    console.error("Error sending typing event:", error);
  }
}

export async function getTypingStatus(
  role: "A" | "B"
): Promise<boolean> {
  try {
    const otherRole = role === "A" ? "B" : "A";
    const response = await fetch(`${API_BASE}/typing?role=${otherRole}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.isTyping || false;
  } catch (error) {
    return false;
  }
}

export async function sendReadReceipt(
  role: "A" | "B",
  messageIds: string[]
): Promise<void> {
  try {
    await fetch(`${API_BASE}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "read_receipt",
        sender: role,
        messageIds,
        timestamp: Date.now(),
      }),
    });
  } catch (error) {
    console.error("Error sending read receipt:", error);
  }
}

export async function getReadStatus(messageId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/read/${messageId}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.read || false;
  } catch (error) {
    return false;
  }
}
