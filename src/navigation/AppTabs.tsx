import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatScreen from '../screens/ChatScreen';
import TrendsScreen from '../screens/TrendsScreen.tsx';
import ProfileScreen from '../screens/ProfileScreen.tsx';

export type AppTabParamList = {
  Chat: undefined;
  Trends: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator initialRouteName="Chat" screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: '채팅' }} />
      <Tab.Screen name="Trends" component={TrendsScreen} options={{ title: '우울증 추이' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: '내 정보' }} />
    </Tab.Navigator>
  );
}
