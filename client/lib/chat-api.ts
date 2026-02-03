// ============================================
// CHAT API - All messaging uses the production server
// Server: https://chat-server-production-6f5d.up.railway.app
// No Firebase, Telegram, or external services
// ============================================

import { getPairing } from "@/lib/secure-storage";

// ============================================
// PAIRING DATA - Fetched from external URL on first unlock
// URL: https://www.zidhuxd.me/chat.json
// ============================================
const PAIRING_URL = "https://www.zidhuxd.me/chat.json";

// ============================================
// PRODUCTION API SERVER
// Hosted on Railway at port 8080
// ============================================
const API_BASE = "https://chat-server-production-6f5d.up.railway.app";

// API keys for authorization (matches server configuration)
const API_KEYS = {
  A: "calc-user-a-key-2024",
  B: "calc-user-b-key-2024",
};

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

// Helper to get authorization header for a role
function getAuthHeader(role: "A" | "B"): { Authorization: string } {
  return { Authorization: `Bearer ${API_KEYS[role]}` };
}

// ============================================
// PAIRING - Fetched from https://www.zidhuxd.me/chat.json
// This is called on first unlock to get pairing data
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
// MESSAGING API - Uses production server
// https://chat-server-production-6f5d.up.railway.app
// ============================================

// Send a new message
export async function sendMessage(
  role: "A" | "B",
  text: string
): Promise<Message | null> {
  try {
    const response = await fetch(`${API_BASE}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(role),
      },
      body: JSON.stringify({
        text,
        localId: `local_${Date.now()}`,
      }),
    });
    if (!response.ok) {
      console.error("Failed to send message:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
}

// Fetch all messages for the conversation
export async function fetchMessages(role: "A" | "B"): Promise<Message[]> {
  try {
    const response = await fetch(`${API_BASE}/api/messages`, {
      method: "GET",
      headers: {
        ...getAuthHeader(role),
      },
    });
    if (!response.ok) {
      console.error("Failed to fetch messages:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

// Poll for new messages (used for real-time updates)
export async function pollMessages(
  role: "A" | "B",
  since: number = 0
): Promise<Message[]> {
  try {
    const response = await fetch(`${API_BASE}/api/poll?since=${since}`, {
      method: "GET",
      headers: {
        ...getAuthHeader(role),
      },
    });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Error polling messages:", error);
    return [];
  }
}

// ============================================
// TYPING EVENTS - Hidden JSON-based typing indicator
// NOT persisted, only held in memory on server
// ============================================

export async function sendTypingEvent(
  role: "A" | "B",
  isTyping: boolean
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/typing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(role),
      },
      body: JSON.stringify({ isTyping }),
    });
  } catch (error) {
    console.error("Error sending typing event:", error);
  }
}

export async function getTypingStatus(role: "A" | "B"): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/typing`, {
      method: "GET",
      headers: {
        ...getAuthHeader(role),
      },
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.isTyping || false;
  } catch (error) {
    return false;
  }
}

// ============================================
// READ RECEIPTS - Blue tick when message is read
// Only activates when chat screen is visibly open
// ============================================

export async function sendReadReceipt(
  role: "A" | "B",
  messageIds: string[]
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(role),
      },
      body: JSON.stringify({ messageIds }),
    });
  } catch (error) {
    console.error("Error sending read receipt:", error);
  }
}

export async function getReadStatus(messageId: string): Promise<boolean> {
  try {
    const pairing = await getPairing();
    if (!pairing) return false;

    const response = await fetch(`${API_BASE}/api/read/${messageId}`, {
      method: "GET",
      headers: {
        ...getAuthHeader(pairing.role),
      },
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.read || false;
  } catch (error) {
    return false;
  }
}
