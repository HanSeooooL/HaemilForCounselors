/**
 * @format
 */
import React from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, InteractionManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import AppStack from './src/navigation/AppStack';
import type { AppStackParamList } from './src/navigation/AppStack';
import RNBootSplash from 'react-native-bootsplash';
import { initPush } from './src/ws/push';
import { postDeviceToken } from './src/api';

const navRef = createNavigationContainerRef<AppStackParamList>();

function Root() {
    const { token, isLoading, justSignedUp } = useAuth();
    const isDarkMode = useColorScheme() === 'dark';
    const [initialScreenResolved, setInitialScreenResolved] = React.useState(false);

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

    React.useEffect(() => {
        if (token && !initialScreenResolved) {
            // Immediately resolve; we'll handle navigation via justSignedUp effect
            setInitialScreenResolved(true);
        }
    }, [token, initialScreenResolved]);

    // Navigate to intro once when conditions are met
    React.useEffect(() => {
        if (token && justSignedUp && navRef.isReady()) {
            const name = navRef.getCurrentRoute()?.name;
            if (name !== 'InitialQuestionnaireIntro') {
                try { navRef.navigate('InitialQuestionnaireIntro'); } catch {}
            }
        }
    }, [token, justSignedUp]);

    React.useEffect(() => {
        // token이 생기는 시점에 push 초기화 (idempotent)
        if (token) {
            initPush({
                onToken: async (fcm) => {
                    try { await postDeviceToken(token, fcm); } catch (e) { console.error('FCM 토큰 서버 등록 실패', e); }
                },
            });
        }
    }, [token]);

    if (isLoading || (token && !initialScreenResolved)) return <View style={styles.container} />;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            {token ? (
                <NavigationContainer ref={navRef}>
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
