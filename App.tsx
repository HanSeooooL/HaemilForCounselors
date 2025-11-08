/**
 * @format
 */
import React from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, InteractionManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import { NavigationContainer } from '@react-navigation/native';
import AppStack from './src/navigation/AppStack';
import RNBootSplash from 'react-native-bootsplash';

function Root() {
    const { token, isLoading } = useAuth();
    const isDarkMode = useColorScheme() === 'dark';

    React.useEffect(() => {
        if (!isLoading) {
            RNBootSplash.hide({ fade: true });
        }
        // 안전장치: 마운트 직후에도 숨김 호출(중복 호출은 무해합니다)
    }, [isLoading]);

    React.useEffect(() => {
        // hide after JS thread is idle to avoid race with initial render
        const task = InteractionManager.runAfterInteractions(() => {
            RNBootSplash.hide({ fade: true });
        });
        // fallback: ensure hide is called even if interactions take long
        const t = setTimeout(() => RNBootSplash.hide({ fade: true }), 500);
        return () => {
            task.cancel?.();
            clearTimeout(t);
        };
    }, []);

    if (isLoading) return <View style={styles.container} />;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            {token ? (
                <NavigationContainer>
                    <AppStack />
                </NavigationContainer>
            ) : (
                <AuthScreen />
            )}
        </View>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <Root />
            </AuthProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
});
