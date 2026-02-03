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
      setInputHistory((prev) => prev + digit);

      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === "0" ? digit : display + digit);
      }
    },
    [display, waitingForOperand]
  );

  const handleOperatorPress = useCallback(
    (nextOperator: string) => {
      setInputHistory((prev) => prev + nextOperator);
      const inputValue = parseFloat(display);

      if (previousValue === null) {
        setPreviousValue(display);
      } else if (operator) {
        const currentValue = previousValue ? parseFloat(previousValue) : 0;
        const result = performCalculation(currentValue, inputValue, operator);
        setDisplay(String(result));
        setPreviousValue(String(result));
      }

      setWaitingForOperand(true);
      setOperator(nextOperator);
    },
    [display, operator, previousValue]
  );

  const performCalculation = (
    left: number,
    right: number,
    op: string
  ): number => {
    switch (op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "×":
        return left * right;
      case "÷":
        return right !== 0 ? left / right : 0;
      default:
        return right;
    }
  };

  const handleEquals = useCallback(async () => {
    // Check for 4-digit unlock code
    const potentialCode = display.replace(/[^0-9]/g, "");
    if (potentialCode.length === 4) {
      const unlocked = await checkForUnlockCode(potentialCode);
      if (unlocked) {
        // Reset calculator state after unlock
        setDisplay("0");
        setPreviousValue(null);
        setOperator(null);
        setWaitingForOperand(false);
        setInputHistory("");
        return;
      }
    }

    // Normal calculator behavior
    if (operator && previousValue !== null) {
      const inputValue = parseFloat(display);
      const currentValue = parseFloat(previousValue);
      const result = performCalculation(currentValue, inputValue, operator);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
    setInputHistory("");
  }, [display, operator, previousValue, checkForUnlockCode]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setInputHistory("");
  }, []);

  const handleToggleSign = useCallback(() => {
    const value = parseFloat(display);
    setDisplay(String(-value));
  }, [display]);

  const handlePercent = useCallback(() => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  }, [display]);

  const handleDecimal = useCallback(() => {
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  }, [display]);

  const formatDisplay = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0";
    if (value.length > 9) {
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
          {formatDisplay(display)}
        </Text>
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
    fontSize: Typography.calculatorDisplay.fontSize,
    fontWeight: Typography.calculatorDisplay.fontWeight,
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
