// file: 'src/screens/HomeScreen.tsx'
import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { NewAppScreen } from '@react-native/new-app-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const { signOut } = useAuth();

    return (
        <View style={styles.container}>
            <NewAppScreen templateFileName="App.tsx" safeAreaInsets={insets} />
            <View style={styles.signout}>
                <Button title="로그아웃" onPress={signOut} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    signout: { position: 'absolute', right: 16, bottom: 24 },
});
