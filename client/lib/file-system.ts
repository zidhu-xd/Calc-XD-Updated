import * as FileSystem from "expo-file-system";

const CHAT_HISTORY_DIR = `${FileSystem.documentDirectory}chat_history/`;

export async function ensureDirectoryExists() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CHAT_HISTORY_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CHAT_HISTORY_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error("Error ensuring chat directory exists:", error);
  }
}

export async function saveChatHistory(filename: string, content: string) {
  try {
    await ensureDirectoryExists();
    const filePath = `${CHAT_HISTORY_DIR}${filename}`;
    
    // Validate content to prevent malformed writes
    let stringContent: string;
    if (typeof content !== 'string') {
      try {
        stringContent = JSON.stringify(content);
      } catch (e) {
        stringContent = String(content);
      }
    } else {
      stringContent = content;
    }
    
    await FileSystem.writeAsStringAsync(filePath, stringContent, {
      encoding: "utf8",
    });
  } catch (error) {
    console.error("rxpo-file-system: method writeAsStringAsync failed.", error);
  }
}

export async function readChatHistory(filename: string): Promise<string | null> {
  try {
    const filePath = `${CHAT_HISTORY_DIR}${filename}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      return await FileSystem.readAsStringAsync(filePath);
    }
    return null;
  } catch (error) {
    console.error("Error reading chat history:", error);
    return null;
  }
}
