import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppTabs from './AppTabs';
import ProfileScreen from '../screens/ProfileScreen';
import InitialQuestionnaireIntro from '../screens/InitialQuestionnaireIntro';
import InitialQuestionnaireForm from '../screens/InitialQuestionnaireForm';

export type AppStackParamList = {
  RootTabs: undefined;
  Profile: undefined;
  InitialQuestionnaireIntro: undefined;
  InitialQuestionnaireForm: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RootTabs" component={AppTabs} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: true, title: '내 정보', headerBackTitle: '뒤로가기' }}
      />
      <Stack.Screen name="InitialQuestionnaireIntro" component={InitialQuestionnaireIntro} options={{ headerShown: false }} />
      <Stack.Screen name="InitialQuestionnaireForm" component={InitialQuestionnaireForm} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
