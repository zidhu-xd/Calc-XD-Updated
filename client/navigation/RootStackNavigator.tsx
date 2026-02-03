import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CalculatorScreen from "@/screens/CalculatorScreen";
import ChatScreen from "@/screens/ChatScreen";

export type RootStackParamList = {
  Calculator: undefined;
  Chat: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Calculator"
      screenOptions={{
        headerShown: false,
        animation: "fade",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="Calculator"
        component={CalculatorScreen}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          animation: "slide_from_bottom",
        }}
      />
    </Stack.Navigator>
  );
}
