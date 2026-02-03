# Calculator Chat App

A hidden messenger app disguised as a fully functional calculator.

## Overview

This app appears as a standard calculator but contains a hidden two-person messaging system. When the correct 4-digit unlock code is entered and the equals button is pressed, the app reveals a private chat interface.

## Project Structure

```
├── client/                    # React Native Expo frontend
│   ├── App.tsx               # Main app entry with auto-lock functionality
│   ├── screens/
│   │   ├── CalculatorScreen.tsx   # Main calculator UI with unlock logic
│   │   └── ChatScreen.tsx         # Hidden chat screen
│   ├── lib/
│   │   ├── secure-storage.ts      # Secure pairing storage (Android Keystore)
│   │   ├── chat-api.ts            # Chat API client functions
│   │   └── query-client.ts        # API base URL helper
│   ├── navigation/
│   │   └── RootStackNavigator.tsx # Stack navigation (Calculator -> Chat)
│   └── constants/
│       └── theme.ts               # Calculator and Chat color themes
├── server/                    # Express.js backend
│   ├── index.ts              # Server entry with CORS and middleware
│   └── routes.ts             # Messaging API endpoints
└── api/                      # Standalone API reference (optional)
    └── server.js             # Alternative standalone API server
```

## Unlock Codes

Pairing data is fetched from: `https://www.zidhuxd.me/chat.json`

- **Code 1234** → User A
- **Code 5678** → User B

## API Endpoints

All messaging uses the Express backend at `/api/*`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/send` | POST | Send a new message |
| `/api/messages` | GET | Get all conversation messages |
| `/api/poll` | GET | Poll for new messages since timestamp |
| `/api/typing` | POST | Send typing indicator event |
| `/api/typing` | GET | Get partner's typing status |
| `/api/read` | POST | Send read receipts for messages |
| `/api/read/:messageId` | GET | Check read status of a message |

### Authorization

All API endpoints require Bearer token authentication:
- User A: `Bearer calc-user-a-key-2024`
- User B: `Bearer calc-user-b-key-2024`

## Security Features

1. **Secure Storage**: Pairing data stored using Android Keystore (expo-secure-store on native, AsyncStorage fallback on web)
2. **Auto-Lock**: App returns to calculator when going to background
3. **Wrong Codes**: Invalid unlock codes behave as normal calculator input
4. **No Persistence**: Typing events and read receipts are never persisted to chat history
5. **Single Conversation**: Only one paired conversation exists at a time

## Chat Features

- **WhatsApp-style UI**: Brown sender bubbles, dark gray receiver bubbles
- **Typing Indicator**: Animated three-dot indicator when partner is typing
- **Read Receipts**: Blue double checkmarks when messages are read
- **Polling**: Messages polled every 1.5 seconds for real-time updates
- **Keyboard Handling**: Proper keyboard avoidance for message input

## Running the App

### Development
```bash
npm run expo:dev     # Start Expo frontend (port 8081)
npm run server:dev   # Start Express backend (port 5000)
```

### Testing via Expo Go
Scan the QR code displayed in the terminal with Expo Go app on your mobile device.

## Building APK (Production)

**Note**: Building a production APK requires EAS (Expo Application Services) which is not available in this environment. To build:

1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Configure: `eas build:configure`
4. Build: `eas build --platform android --profile production`

The code is production-ready and will work with EAS Build.

## Color Palette

### Calculator
- Background: `#1C1C1C`
- Number buttons: `#2D2D2D`
- Operator buttons: `#FF9F0A` (orange)
- Text: `#FFFFFF`

### Chat
- Background: `#0D0D0D`
- Header: `#1F1F1F`
- Sender bubbles: `#7D6E5C` (brown)
- Receiver bubbles: `#3A3A3A`
- Read receipts: `#34B7F1` (blue)
