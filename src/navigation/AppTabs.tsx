import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatStack from './ChatStack';
import TrendsScreen from '../screens/TrendsScreen.tsx';
import MenuScreen from '../screens/MenuScreen.tsx';
import CustomTabBar from './CustomTabBar';
import { TabBarHeightContext } from './TabBarHeightContext';

export type AppTabParamList = {
  Chat: undefined;
  Trends: undefined;
  Menu: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppTabs() {
  const [tabBarHeight, setTabBarHeight] = useState<number>(72);
  return (
    <TabBarHeightContext.Provider value={[tabBarHeight, setTabBarHeight]}>
      <Tab.Navigator initialRouteName="Chat" screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
        <Tab.Screen name="Chat" component={ChatStack} options={{ title: '상담' }} />
        <Tab.Screen name="Trends" component={TrendsScreen} options={{ title: '우울증 추이' }} />
        <Tab.Screen name="Menu" component={MenuScreen} options={{ title: '전체 메뉴' }} />
      </Tab.Navigator>
    </TabBarHeightContext.Provider>
  );
}
