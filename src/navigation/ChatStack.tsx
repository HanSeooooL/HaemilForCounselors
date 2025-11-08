import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from '../screens/ChatScreen';
import CounselListScreen from '../screens/CounselListScreen';

export type ChatStackParamList = {
  CounselList: undefined;
  Chat: { mode?: 'bot' | 'counselor'; counselorId?: string; title?: string };
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CounselList" component={CounselListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
