import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Image } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabBarHeightContext } from './TabBarHeightContext';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [height, setHeight] = React.useContext(TabBarHeightContext);

  // Determine if the Chat tab's nested navigator currently has the 'Chat' route active.
  const chatTabIndex = state.routes.findIndex((r) => r.name === 'Chat');
  const chatTabState = chatTabIndex >= 0 ? (state.routes[chatTabIndex] as any).state : undefined;
  const chatNestedActiveName = chatTabState ? chatTabState.routes?.[chatTabState.index]?.name : undefined;
  const hideForChatScreen = chatNestedActiveName === 'Chat' && state.index === chatTabIndex;

  // When hiding, update the measured height to 0 so consumers (ChatScreen) don't offset by previous height.
  useEffect(() => {
    if (hideForChatScreen) {
      try { setHeight(0); } catch (e) {}
    }
  }, [hideForChatScreen, setHeight]);

  if (hideForChatScreen) return null;

  return (
    <View style={styles.container} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true as const });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name as any);
          }
        };

        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

        // 아이콘 매핑
        const iconSource =
          route.name === 'Chat'
            ? require('../../assets/counsel-icon.png')
            : route.name === 'Trends'
            ? require('../../assets/graph-icon.png')
            : require('../../assets/menu-icon.png');

        const label = descriptors[route.key].options.title ?? route.name;

        const opts = descriptors[route.key].options as any;

        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={opts.tabBarAccessibilityLabel}
            testID={opts.tabBarTestID}
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.item}
            activeOpacity={0.8}
          >
            <Image source={iconSource} style={[styles.icon, isFocused && styles.iconActive]} resizeMode="contain" />
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  // make each tab take equal width so center is exactly centered
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  icon: { width: 28, height: 28, marginBottom: 6, tintColor: '#8e8e93' },
  iconActive: { tintColor: '#6a8f3a' },
  label: { fontSize: 13, color: '#8e8e93' },
  labelActive: { color: '#6a8f3a' },
});
