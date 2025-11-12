// filepath: /Users/hanseol/Desktop/projects/HaemilForCounseolrs/jest.setup.js
// Mock AsyncStorage for Jest environment
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Some RN modules require basic mocks
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock Encrypted Storage
jest.mock('react-native-encrypted-storage', () => {
  let store = {};
  return {
    setItem: async (key, value) => { store[key] = value; },
    getItem: async (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    removeItem: async (key) => { delete store[key]; },
  };
});

// Safe area context mock basics
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    SafeAreaProvider: ({ children }) => children,
  };
});

// React Native Gesture Handler jest setup
import 'react-native-gesture-handler/jestSetup';

// Mock react-navigation modules to avoid ESM parsing in Jest
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const refObj = { current: null };
  return {
    NavigationContainer: ({ children }) => React.createElement(React.Fragment, null, children),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    createNavigationContainerRef: () => refObj,
  };
});

jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }) => React.createElement(React.Fragment, null, children),
      Screen: () => null,
    }),
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }) => React.createElement(React.Fragment, null, children),
      Screen: () => null,
    }),
  };
});

// Mock react-native-bootsplash to avoid native calls in Jest
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(() => Promise.resolve()),
  isVisible: jest.fn(() => Promise.resolve(true)),
}));

// Mock notifee
jest.mock('@notifee/react-native', () => ({
  requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
  createChannel: jest.fn(async () => 'default'),
  displayNotification: jest.fn(async () => {}),
  onForegroundEvent: jest.fn(() => () => {}),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  EventType: { PRESS: 1 },
}));

// Mock @react-native-firebase/messaging
jest.mock('@react-native-firebase/messaging', () => {
  const listeners = { onMessage: null, onTokenRefresh: null };
  const api = () => ({
    requestPermission: jest.fn(async () => 1),
    getToken: jest.fn(async () => 'test-token'),
    onMessage: jest.fn((cb) => { listeners.onMessage = cb; return () => { listeners.onMessage = null; }; }),
    onTokenRefresh: jest.fn((cb) => { listeners.onTokenRefresh = cb; return () => { listeners.onTokenRefresh = null; }; }),
    setBackgroundMessageHandler: jest.fn(() => {}),
    AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  });
  api.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2 };
  return api;
});
