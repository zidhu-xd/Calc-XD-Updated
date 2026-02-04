import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  AppState,
  AppStateStatus,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CalculatorColors, Typography } from "@/constants/theme";
import {
  fetchPairingData,
  findPairingByCode,
} from "@/lib/chat-api";
import { savePairing, getPairing, PairingData } from "@/lib/secure-storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BUTTON_SIZE = (SCREEN_WIDTH - 60) / 4;
const BUTTON_MARGIN = 8;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CalculatorButtonProps {
  label: string;
  onPress: () => void;
  isOperator?: boolean;
  isWide?: boolean;
  testID?: string;
}

function CalculatorButton({
  label,
  onPress,
  isOperator = false,
  isWide = false,
  testID,
}: CalculatorButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value === 1 ? 1 : CalculatorColors.buttonPress,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.button,
        isOperator && styles.operatorButton,
        isWide && styles.wideButton,
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          isOperator && styles.operatorButtonText,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export default function CalculatorScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [inputHistory, setInputHistory] = useState("");
  const [storedPairing, setStoredPairing] = useState<PairingData | null>(null);

  useEffect(() => {
    loadStoredPairing();
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const loadStoredPairing = async () => {
    const pairing = await getPairing();
    setStoredPairing(pairing);
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    // Auto-lock functionality is handled in App.tsx
  };

  // ============================================
  // UNLOCK LOGIC - Check for 4-digit code on equals press
  // Fetches pairing from https://www.zidhuxd.me/chat.json
  // ============================================
  const checkForUnlockCode = useCallback(
    async (code: string): Promise<boolean> => {
      // If already paired, check against stored code
      if (storedPairing) {
        if (code === storedPairing.code) {
          navigation.navigate("Chat");
          return true;
        }
        return false;
      }

      // First time unlock - fetch pairing data
      const pairingData = await fetchPairingData();
      if (!pairingData) return false;

      const pairing = findPairingByCode(pairingData, code);
      if (pairing) {
        // Save pairing permanently to secure storage
        await savePairing(pairing);
        setStoredPairing(pairing);
        navigation.navigate("Chat");
        return true;
      }

      return false;
    },
    [navigation, storedPairing]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (display === "0" || waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay(display + digit);
      }
    },
    [display, waitingForOperand]
  );

  const handleOperatorPress = useCallback(
    (nextOperator: string) => {
      // If the last character is an operator, replace it
      const lastChar = display[display.length - 1];
      const operators = ["+", "-", "×", "÷"];
      if (operators.includes(lastChar)) {
        setDisplay(display.slice(0, -1) + nextOperator);
      } else {
        setDisplay(display + nextOperator);
      }
      setWaitingForOperand(false);
    },
    [display]
  );

  const calculateExpression = (expr: string): number | null => {
    try {
      // Basic expression evaluator for +, -, ×, ÷
      // We'll replace × with * and ÷ with /
      const sanitizedExpr = expr.replace(/×/g, "*").replace(/÷/g, "/");
      
      // Check if it ends with an operator
      if (["+", "-", "*", "/"].includes(sanitizedExpr.slice(-1))) {
        return null;
      }

      // Use a simple evaluation logic
      // Note: For a production app, a proper parser would be better
      // but for simple calculator logic this is okay.
      // We'll use Function as a safe-ish alternative to eval for simple math
      const result = new Function(`return ${sanitizedExpr}`)();
      return typeof result === "number" && isFinite(result) ? result : null;
    } catch (e) {
      return null;
    }
  };

  const livePreview = useCallback(() => {
    // Only show preview if there's an operator in the expression
    const operators = ["+", "-", "×", "÷"];
    if (operators.some(op => display.includes(op))) {
      return calculateExpression(display);
    }
    return null;
  }, [display]);

  const previewResult = livePreview();

  const handleEquals = useCallback(async () => {
    // Check for 4-digit unlock code
    const potentialCode = display.replace(/[^0-9]/g, "");
    if (potentialCode.length === 4) {
      const unlocked = await checkForUnlockCode(potentialCode);
      if (unlocked) {
        setDisplay("0");
        setWaitingForOperand(false);
        return;
      }
    }

    const result = calculateExpression(display);
    if (result !== null) {
      setDisplay(String(result));
      setWaitingForOperand(true);
    }
  }, [display, checkForUnlockCode]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setWaitingForOperand(false);
  }, []);

  const handleToggleSign = useCallback(() => {
    // For expression based, we just negate the current result if possible
    const result = calculateExpression(display);
    if (result !== null) {
      setDisplay(String(-result));
    }
  }, [display]);

  const handlePercent = useCallback(() => {
    const result = calculateExpression(display);
    if (result !== null) {
      setDisplay(String(result / 100));
    }
  }, [display]);

  const handleDecimal = useCallback(() => {
    const lastPart = display.split(/[\+\-\×\÷]/).pop() || "";
    if (!lastPart.includes(".")) {
      setDisplay(display + ".");
    }
  }, [display]);

  const formatDisplay = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (value.length > 12) {
      return num.toExponential(3);
    }
    return value;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.displayContainer}>
        <Text
          style={styles.displayText}
          numberOfLines={1}
          adjustsFontSizeToFit
          testID="calculator-display"
        >
          {display}
        </Text>
        {previewResult !== null && (
          <Text
            style={styles.previewText}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatDisplay(String(previewResult))}
          </Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.row}>
          <CalculatorButton
            label="AC"
            onPress={handleClear}
            testID="button-clear"
          />
          <CalculatorButton
            label="+/-"
            onPress={handleToggleSign}
            testID="button-sign"
          />
          <CalculatorButton
            label="%"
            onPress={handlePercent}
            testID="button-percent"
          />
          <CalculatorButton
            label="÷"
            onPress={() => handleOperatorPress("÷")}
            isOperator
            testID="button-divide"
          />
        </View>

        <View style={styles.row}>
          <CalculatorButton
            label="7"
            onPress={() => handleDigitPress("7")}
            testID="button-7"
          />
          <CalculatorButton
            label="8"
            onPress={() => handleDigitPress("8")}
            testID="button-8"
          />
          <CalculatorButton
            label="9"
            onPress={() => handleDigitPress("9")}
            testID="button-9"
          />
          <CalculatorButton
            label="×"
            onPress={() => handleOperatorPress("×")}
            isOperator
            testID="button-multiply"
          />
        </View>

        <View style={styles.row}>
          <CalculatorButton
            label="4"
            onPress={() => handleDigitPress("4")}
            testID="button-4"
          />
          <CalculatorButton
            label="5"
            onPress={() => handleDigitPress("5")}
            testID="button-5"
          />
          <CalculatorButton
            label="6"
            onPress={() => handleDigitPress("6")}
            testID="button-6"
          />
          <CalculatorButton
            label="-"
            onPress={() => handleOperatorPress("-")}
            isOperator
            testID="button-subtract"
          />
        </View>

        <View style={styles.row}>
          <CalculatorButton
            label="1"
            onPress={() => handleDigitPress("1")}
            testID="button-1"
          />
          <CalculatorButton
            label="2"
            onPress={() => handleDigitPress("2")}
            testID="button-2"
          />
          <CalculatorButton
            label="3"
            onPress={() => handleDigitPress("3")}
            testID="button-3"
          />
          <CalculatorButton
            label="+"
            onPress={() => handleOperatorPress("+")}
            isOperator
            testID="button-add"
          />
        </View>

        <View style={styles.row}>
          <CalculatorButton
            label="0"
            onPress={() => handleDigitPress("0")}
            isWide
            testID="button-0"
          />
          <CalculatorButton
            label="."
            onPress={handleDecimal}
            testID="button-decimal"
          />
          <CalculatorButton
            label="="
            onPress={handleEquals}
            isOperator
            testID="button-equals"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CalculatorColors.background,
    justifyContent: "flex-end",
  },
  displayContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  displayText: {
    color: CalculatorColors.displayText,
    fontSize: 60,
    fontWeight: "300",
    textAlign: "right",
    marginBottom: 10,
  },
  previewText: {
    color: CalculatorColors.displayText,
    opacity: 0.6,
    fontSize: 40,
    fontWeight: "300",
    textAlign: "right",
  },
  buttonContainer: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: BUTTON_MARGIN,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: CalculatorColors.numberButton,
    justifyContent: "center",
    alignItems: "center",
  },
  operatorButton: {
    backgroundColor: CalculatorColors.operatorButton,
  },
  wideButton: {
    width: BUTTON_SIZE * 2 + BUTTON_MARGIN,
    borderRadius: BUTTON_SIZE / 2,
  },
  buttonText: {
    color: CalculatorColors.buttonText,
    fontSize: Typography.calculatorButton.fontSize,
    fontWeight: Typography.calculatorButton.fontWeight,
  },
  operatorButtonText: {
    fontSize: 28,
  },
});
