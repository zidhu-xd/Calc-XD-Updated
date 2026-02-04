import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";

// ============================================
// IN-MEMORY MESSAGE STORAGE
// Messages are stored temporarily and never persisted to disk
// ============================================
interface StoredMessage {
  id: string;
  localId: string | null;
  text: string;
  sender: "A" | "B";
  recipient: "A" | "B";
  timestamp: number;
  delivered: boolean;
  read: boolean;
}

let messages: StoredMessage[] = [];
let messageIdCounter = 1;

// Typing status - NOT persisted, only held in memory temporarily
const typingStatus: Record<string, { isTyping: boolean; timestamp: number }> = {
  A: { isTyping: false, timestamp: 0 },
  B: { isTyping: false, timestamp: 0 },
};

// Read receipts tracking - which messages have been read
const readReceipts = new Map<string, boolean>();

// ============================================
// PAIRING & SECURITY CONFIGURATION
// Static API keys for the two paired users
// ============================================
const API_KEYS: Record<string, "A" | "B"> = {
  "calc-user-a-key-2024": "A",
  "calc-user-b-key-2024": "B",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPartnerRole(role: "A" | "B"): "A" | "B" {
  return role === "A" ? "B" : "A";
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${messageIdCounter++}`;
}

function cleanupTypingStatus(): void {
  const now = Date.now();
  const TYPING_TIMEOUT = 3000;

  for (const role of ["A", "B"] as const) {
    if (
      typingStatus[role].isTyping &&
      now - typingStatus[role].timestamp > TYPING_TIMEOUT
    ) {
      typingStatus[role].isTyping = false;
    }
  }
}

// ============================================
// AUTHORIZATION MIDDLEWARE
// Validates API key and extracts user role
// ============================================
function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Missing or invalid authorization header" });
    return;
  }

  const apiKey = authHeader.slice(7);
  const userRole = API_KEYS[apiKey];

  if (!userRole) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  (req as any).userRole = userRole;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ============================================
  // MESSAGING API ROUTES
  // All endpoints prefixed with /api
  // ============================================

  // Health check endpoint (no auth required)
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // ============================================
  // POST /api/send - Send a new message
  // Body: { text: string, localId?: string }
  // Returns: { id, text, sender, timestamp, read }
  // ============================================
  app.post("/api/send", authMiddleware, (req: Request, res: Response) => {
    const { text, localId } = req.body;
    const sender = (req as any).userRole as "A" | "B";

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Message text is required" });
      return;
    }

    if (text.length > 5000) {
      res.status(400).json({ error: "Message too long (max 5000 characters)" });
      return;
    }

    const message: StoredMessage = {
      id: generateMessageId(),
      localId: localId || null,
      text: text.trim(),
      sender: sender,
      recipient: getPartnerRole(sender),
      timestamp: Date.now(),
      delivered: false,
      read: false,
    };

    messages.push(message);
    readReceipts.set(message.id, false);

    console.log(
      `[MESSAGE] ${sender} -> ${message.recipient}: "${text.substring(0, 50)}..."`
    );

    res.status(201).json({
      id: message.id,
      localId: message.localId,
      text: message.text,
      sender: message.sender,
      timestamp: message.timestamp,
      read: message.read,
    });
  });

  // ============================================
  // GET /api/poll - Poll for new messages
  // Query: ?since=timestamp (optional)
  // Returns: Array of messages for this user
  // ============================================
  app.get("/api/poll", authMiddleware, (req: Request, res: Response) => {
    const userRole = (req as any).userRole as "A" | "B";
    const since = parseInt(req.query.since as string) || 0;

    cleanupTypingStatus();

    const userMessages = messages
      .filter((msg) => msg.recipient === userRole && msg.timestamp > since)
      .map((msg) => {
        msg.delivered = true;
        return {
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          timestamp: msg.timestamp,
          read: readReceipts.get(msg.id) || false,
        };
      });

    const sentMessages = messages
      .filter((msg) => msg.sender === userRole && msg.timestamp > since)
      .map((msg) => ({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp,
        read: readReceipts.get(msg.id) || false,
      }));

    const allMessages = [...userMessages, ...sentMessages].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    res.json(allMessages);
  });

  // ============================================
  // GET /api/messages - Get all messages for conversation
  // Returns: Full message history for this user's conversation
  // ============================================
  app.get("/api/messages", authMiddleware, (req: Request, res: Response) => {
    const userRole = (req as any).userRole as "A" | "B";

    const conversationMessages = messages
      .filter((msg) => msg.sender === userRole || msg.recipient === userRole)
      .map((msg) => ({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp,
        read: readReceipts.get(msg.id) || false,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    res.json(conversationMessages);
  });

  // ============================================
  // POST /api/typing - Send typing indicator
  // Body: { isTyping: boolean }
  // Typing events are NEVER persisted
  // ============================================
  app.post("/api/typing", authMiddleware, (req: Request, res: Response) => {
    const { isTyping } = req.body;
    const sender = (req as any).userRole as "A" | "B";

    if (typeof isTyping !== "boolean") {
      res.status(400).json({ error: "isTyping must be a boolean" });
      return;
    }

    typingStatus[sender] = {
      isTyping: isTyping,
      timestamp: Date.now(),
    };

    res.json({ success: true });
  });

  // ============================================
  // GET /api/typing - Get partner's typing status
  // Returns: { isTyping: boolean }
  // ============================================
  app.get("/api/typing", authMiddleware, (req: Request, res: Response) => {
    const userRole = (req as any).userRole as "A" | "B";
    const partnerRole = getPartnerRole(userRole);

    cleanupTypingStatus();

    res.json({
      isTyping: typingStatus[partnerRole].isTyping,
    });
  });

  // ============================================
  // POST /api/read - Send read receipts
  // Body: { messageIds: string[] }
  // Marks messages as read
  // ============================================
  app.post("/api/read", authMiddleware, (req: Request, res: Response) => {
    const { messageIds } = req.body;
    const reader = (req as any).userRole as "A" | "B";

    if (!Array.isArray(messageIds)) {
      res.status(400).json({ error: "messageIds must be an array" });
      return;
    }

    let updatedCount = 0;

    for (const msgId of messageIds) {
      const message = messages.find((m) => m.id === msgId);

      if (message && message.recipient === reader && !readReceipts.get(msgId)) {
        readReceipts.set(msgId, true);
        message.read = true;
        updatedCount++;
        console.log(`[READ] ${reader} read message ${msgId}`);
      }
    }

    res.json({ success: true, updated: updatedCount });
  });

  // ============================================
  // GET /api/read/:messageId - Check read status of a message
  // Returns: { read: boolean }
  // ============================================
  app.get(
    "/api/read/:messageId",
    authMiddleware,
    (req: Request, res: Response) => {
      const { messageId } = req.params;
      const isRead = readReceipts.get(messageId as string) || false;
      res.json({ read: isRead });
    }
  );

  // ============================================
  // DELETE /api/messages - Clear all messages permanently
  // ============================================
  app.delete("/api/messages", authMiddleware, (req: Request, res: Response) => {
    const userRole = (req as any).userRole as "A" | "B";
    
    // Filter out messages where the user is either sender or recipient
    messages = messages.filter(
      (msg) => msg.sender !== userRole && msg.recipient !== userRole
    );
    
    // Cleanup read receipts for deleted messages
    const messageIds = new Set(messages.map(m => m.id));
    for (const id of readReceipts.keys()) {
      if (!messageIds.has(id)) {
        readReceipts.delete(id);
      }
    }

    console.log(`[ADMIN] Messages cleared for user ${userRole}`);
    res.json({ success: true, message: "Conversation history permanently deleted from server" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
