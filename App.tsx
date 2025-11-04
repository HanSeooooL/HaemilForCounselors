/**
 * @format
 */
import React from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import { NavigationContainer } from '@react-navigation/native';
import AppTabs from './src/navigation/AppTabs';
import RNBootSplash from 'react-native-bootsplash';

function Root() {
    const { token, isLoading } = useAuth();
    const isDarkMode = useColorScheme() === 'dark';

    React.useEffect(() => {
        if (!isLoading) {
            RNBootSplash.hide({ fade: true });
        }
    }, [isLoading]);

    if (isLoading) return <View style={styles.container} />;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            {token ? (
                <NavigationContainer>
                    <AppTabs />
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
    container: { flex: 1 },
});
