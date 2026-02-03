# Design Guidelines: Calculator (Hidden Messenger)

## Brand Identity

**Purpose**: A stealth messaging app disguised as a fully functional calculator. The calculator must be COMPLETELY convincing - indistinguishable from a standard Android calculator app.

**Aesthetic Direction**: Dual personality design
- **Public Face (Calculator)**: Utilitarian, clean, standard Android calculator aesthetic. Zero personality, zero memorability. Blend in completely.
- **Hidden Face (Chat)**: Warm, intimate, WhatsApp-inspired messaging interface. Comfortable for extended private conversations.

**Memorable Element**: The seamless transformation from mundane utility to private sanctuary.

## Navigation Architecture

**Root Navigation**: Stack-Only (no tabs, no drawer)

**Screen Hierarchy**:
1. **Calculator Screen** (Launch screen) - Fully functional calculator, secret unlock mechanism
2. **Chat Screen** (Modal, replaces stack on unlock) - Single conversation messaging interface

**Auth**: None. Pairing is established via unlock code + API fetch, stored securely in Android Keystore.

## Screen-by-Screen Specifications

### 1. Calculator Screen

**Purpose**: Convince any observer this is a normal calculator. Also serve as security gate.

**Layout**:
- Header: None (full-screen calculator)
- Main content: Grid-based calculator interface
- No floating elements
- Safe area insets: None (edge-to-edge for authenticity)

**Components**:
- Display panel (top ~25% of screen): Shows calculation input and result
- Button grid (bottom ~75%): Standard calculator buttons (0-9, operators, equals, clear, decimal)
- All buttons must have subtle press feedback (slight opacity change)

**Visual Design**:
- Match Android stock calculator aesthetic EXACTLY
- Dark theme recommended (dark gray background, white text)
- Button grid: 4 columns, standard spacing
- Operator buttons slightly distinguished (different background color)
- NO app branding, NO unusual elements

**Behavior Note**: When correct 4-digit code + equals is pressed, immediately navigate to Chat Screen.

---

### 2. Chat Screen

**Purpose**: Private two-person messaging with real-time updates, typing awareness, and read receipts.

**Layout**:
- Header: Custom (non-transparent, elevated)
  - Left: Back arrow (returns to calculator, locks app)
  - Center: No title (or minimal generic title like "Messages")
  - Right: No buttons
- Main content: Scrollable message list (reverse chronological, newest at bottom)
- Bottom: Fixed message input bar
- Safe area insets:
  - Top: 0 (header handles insets)
  - Bottom: insets.bottom + 16px

**Components**:

**Header (56px height)**:
- Background: #1F1F1F (dark gray)
- Subtle shadow beneath (shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.08, shadowRadius: 4)

**Message Bubbles**:
- Sender (user's messages): 
  - Background: #7D6E5C (brown)
  - Text: #FFFFFF
  - Align: Right
  - Max width: 80% of screen
  - Padding: 12px horizontal, 8px vertical
  - Border radius: 16px (top-left), 16px (top-right), 4px (bottom-right), 16px (bottom-left)
- Receiver (other person's messages):
  - Background: #3A3A3A (dark gray)
  - Text: #FFFFFF
  - Align: Left
  - Max width: 80% of screen
  - Padding: 12px horizontal, 8px vertical
  - Border radius: 16px (top-left), 16px (top-right), 16px (bottom-right), 4px (bottom-left)
- Spacing between bubbles: 4px
- Spacing between message groups: 12px

**Read Receipts**:
- Position: Bottom-right corner of sender bubbles, outside the bubble
- Icon: Double checkmark (blue when read, gray when sent)
- Color when read: #34B7F1 (WhatsApp blue)
- Color when unread: #7A7A7A
- Size: 14px

**Typing Indicator**:
- Position: Appears as a receiver bubble when other person is typing
- Visual: Three animated dots (fade in/out pulse)
- Background: #3A3A3A (same as receiver bubble)
- Dot color: #7A7A7A
- Animation: Gentle pulse, 1.2s cycle

**Message Input Bar** (fixed to bottom):
- Background: #262626
- Height: 56px + insets.bottom
- Border top: 1px solid #3A3A3A
- Text input:
  - Background: #3A3A3A
  - Border radius: 24px
  - Padding: 12px 16px
  - Placeholder: "Type a message..." (#7A7A7A)
  - Text color: #FFFFFF
- Send button:
  - Icon: Arrow or send icon
  - Color: #7D6E5C (brown, matching sender bubbles)
  - Position: Right edge of input bar, 12px margin
  - Size: 40px circle
  - Press feedback: Slight scale down + opacity

**Empty State**:
- Icon: Lock or shield icon (not custom illustration, use system icon)
- Text: "Secured conversation" (#7A7A7A)
- Position: Center of screen when no messages

---

## Color Palette

**Calculator Screen**:
- Background: #1C1C1C
- Display text: #FFFFFF
- Number buttons: #2D2D2D
- Operator buttons: #FF9F0A (orange accent)
- Button text: #FFFFFF
- Button press: 80% opacity

**Chat Screen**:
- Screen background: #0D0D0D (very dark)
- Header background: #1F1F1F
- Sender bubble: #7D6E5C (brown)
- Receiver bubble: #3A3A3A (dark gray)
- Input bar background: #262626
- Input field background: #3A3A3A
- Text primary: #FFFFFF
- Text secondary: #7A7A7A
- Read receipt (active): #34B7F1 (blue)
- Read receipt (inactive): #7A7A7A

## Typography

**Font**: System default (Roboto on Android)

**Type Scale**:
- Calculator display: 48px Bold (#FFFFFF)
- Calculator buttons: 20px Medium (#FFFFFF)
- Chat message text: 16px Regular (#FFFFFF)
- Chat input placeholder: 16px Regular (#7A7A7A)
- Typing indicator: 14px Regular (#7A7A7A)

## Assets to Generate

1. **icon.png**
   - Description: Standard calculator icon (white calculator symbol on gradient background, indistinguishable from real calculator apps)
   - Where used: App launcher icon

2. **splash-icon.png**
   - Description: Same as app icon
   - Where used: Splash screen during app launch

NO custom illustrations needed. This app must remain visually inconspicuous. Use standard system icons only (Feather icons from @expo/vector-icons for send button, back arrow, checkmarks).