import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  AppState,
  AppStateStatus,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ChatColors, BorderRadius, Spacing } from "@/constants/theme";
import { getPairing, PairingData } from "@/lib/secure-storage";
import {
  Message,
  sendMessage,
  fetchMessages,
  sendTypingEvent,
  getTypingStatus,
  sendReadReceipt,
} from "@/lib/chat-api";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================
// TYPING INDICATOR - Three animated dots
// ============================================
function TypingIndicator() {
  const dot1Opacity = useSharedValue(0.3);
  const dot2Opacity = useSharedValue(0.3);
  const dot3Opacity = useSharedValue(0.3);

  useEffect(() => {
    dot1Opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ),
      -1
    );

    setTimeout(() => {
      dot2Opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1
      );
    }, 200);

    setTimeout(() => {
      dot3Opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1
      );
    }, 400);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1Opacity.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2Opacity.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3Opacity.value }));

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, dot1Style]} />
        <Animated.View style={[styles.typingDot, dot2Style]} />
        <Animated.View style={[styles.typingDot, dot3Style]} />
      </View>
    </View>
  );
}

// ============================================
// READ RECEIPT - Blue double checkmarks
// ============================================
function ReadReceipt({ isRead }: { isRead: boolean }) {
  return (
    <View style={styles.readReceiptContainer}>
      <Feather
        name="check"
        size={12}
        color={isRead ? ChatColors.readReceiptActive : ChatColors.readReceiptInactive}
      />
      <Feather
        name="check"
        size={12}
        color={isRead ? ChatColors.readReceiptActive : ChatColors.readReceiptInactive}
        style={styles.secondCheck}
      />
    </View>
  );
}

// ============================================
// MESSAGE BUBBLE - WhatsApp style
// ============================================
function MessageBubble({
  message,
  isSender,
}: {
  message: Message;
  isSender: boolean;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        styles.messageBubble,
        isSender ? styles.senderBubble : styles.receiverBubble,
      ]}
    >
      <Text style={styles.messageText}>{message.text}</Text>
      {isSender ? (
        <ReadReceipt isRead={message.read} />
      ) : null}
    </Animated.View>
  );
}

// ============================================
// EMPTY STATE
// ============================================
function EmptyState() {
  return (
    <View style={styles.emptyStateContainer}>
      <Feather name="lock" size={48} color={ChatColors.textSecondary} />
      <Text style={styles.emptyStateText}>Secured conversation</Text>
    </View>
  );
}

export default function ChatScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [pairing, setPairing] = useState<PairingData | null>(null);
  const [isScreenVisible, setIsScreenVisible] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sendButtonScale = useSharedValue(1);
  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  useEffect(() => {
    loadPairing();
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (pairing && isScreenVisible) {
      startPolling();
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [pairing, isScreenVisible]);

  const loadPairing = async () => {
    const stored = await getPairing();
    setPairing(stored);
  };

  // ============================================
  // AUTO-LOCK - Navigate back to calculator on background
  // ============================================
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === "background" || nextAppState === "inactive") {
      setIsScreenVisible(false);
      navigation.goBack();
    } else if (nextAppState === "active") {
      setIsScreenVisible(true);
    }
  };

  // ============================================
  // POLLING - Every 1.5 seconds for messages and typing status
  // Uses REST API at https://zidhuxd.me/api
  // ============================================
  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const poll = async () => {
      if (!pairing) return;

      const newMessages = await fetchMessages(pairing.role);
      setMessages(newMessages);

      // Send read receipts for unread messages when screen is visible
      if (isScreenVisible) {
        const unreadMessages = newMessages.filter(
          (m) => m.sender !== pairing.role && !m.read
        );
        if (unreadMessages.length > 0) {
          await sendReadReceipt(
            pairing.role,
            unreadMessages.map((m) => m.id)
          );
        }
      }

      const typing = await getTypingStatus(pairing.role);
      setOtherTyping(typing);
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 1500);
  };

  // ============================================
  // TYPING EVENTS - Hidden JSON-based typing indicator
  // ============================================
  const handleInputChange = (text: string) => {
    setInputText(text);

    if (!pairing) return;

    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      sendTypingEvent(pairing.role, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (pairing) sendTypingEvent(pairing.role, false);
    }, 2000);
  };

  // ============================================
  // SEND MESSAGE - Uses https://zidhuxd.me/api/messages
  // ============================================
  const handleSend = async () => {
    if (!inputText.trim() || !pairing) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendButtonScale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );

    const text = inputText.trim();
    setInputText("");
    setIsTyping(false);
    sendTypingEvent(pairing.role, false);

    const newMessage = await sendMessage(pairing.role, text);
    if (newMessage) {
      setMessages((prev) => [...prev, newMessage]);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      isSender={item.sender === pairing?.role}
    />
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable
        onPress={handleBackPress}
        style={styles.backButton}
        testID="button-back"
      >
        <Feather name="arrow-left" size={24} color={ChatColors.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle}>Messages</Text>
      <View style={styles.headerRight} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderHeader()}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted={messages.length > 0}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={EmptyState}
          ListHeaderComponent={
            otherTyping ? (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <TypingIndicator />
              </Animated.View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          testID="message-list"
        />

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={ChatColors.textSecondary}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              testID="input-message"
            />
          </View>

          <AnimatedPressable
            onPress={handleSend}
            style={[styles.sendButton, sendButtonAnimatedStyle]}
            disabled={!inputText.trim()}
            testID="button-send"
          >
            <Feather
              name="send"
              size={20}
              color={
                inputText.trim()
                  ? ChatColors.textPrimary
                  : ChatColors.textSecondary
              }
            />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ChatColors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ChatColors.headerBackground,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    color: ChatColors.textPrimary,
    fontSize: 17,
    fontWeight: "600",
  },
  headerRight: {
    width: 40,
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexGrow: 1,
  },
  emptyList: {
    justifyContent: "center",
    alignItems: "center",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 2,
  },
  senderBubble: {
    alignSelf: "flex-end",
    backgroundColor: ChatColors.senderBubble,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  receiverBubble: {
    alignSelf: "flex-start",
    backgroundColor: ChatColors.receiverBubble,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
  },
  messageText: {
    color: ChatColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  readReceiptContainer: {
    flexDirection: "row",
    alignSelf: "flex-end",
    marginTop: 2,
    marginRight: -4,
  },
  secondCheck: {
    marginLeft: -8,
  },
  typingContainer: {
    alignSelf: "flex-start",
    marginVertical: Spacing.sm,
  },
  typingBubble: {
    flexDirection: "row",
    backgroundColor: ChatColors.receiverBubble,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ChatColors.textSecondary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: ChatColors.inputBarBackground,
    borderTopWidth: 1,
    borderTopColor: ChatColors.border,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: ChatColors.inputFieldBackground,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginRight: Spacing.md,
    minHeight: 44,
    maxHeight: 120,
  },
  textInput: {
    color: ChatColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ChatColors.sendButton,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    color: ChatColors.textSecondary,
    fontSize: 16,
    marginTop: Spacing.lg,
  },
});
