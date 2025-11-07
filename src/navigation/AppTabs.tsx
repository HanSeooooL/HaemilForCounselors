import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatScreen from '../screens/ChatScreen';
import TrendsScreen from '../screens/TrendsScreen.tsx';
import MenuScreen from '../screens/MenuScreen.tsx';

export type AppTabParamList = {
  Chat: undefined;
  Trends: undefined;
  Menu: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator initialRouteName="Chat" screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: '채팅' }} />
      <Tab.Screen name="Trends" component={TrendsScreen} options={{ title: '우울증 추이' }} />
      <Tab.Screen name="Menu" component={MenuScreen} options={{ title: '전체 메뉴' }} />
    </Tab.Navigator>
  );
}
