// Firebase Cloud Messaging (FCM) helper
// - 요청 시 알림 권한을 확보하고 FCM 토큰을 발급
// - 토큰은 모듈 레벨에서 캐싱하여 중복 네트워크 호출 최소화
// - 토큰 리프레시(onTokenRefresh) 이벤트를 구독하여 최신 토큰 유지
// 사용 예:
//   import { initFcm } from './firebaseMessaging';
//   const fcmToken = await initFcm();
//   // 로그인/회원가입 시 서버로 전송

import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';

let cachedToken: string | null = null;
let requesting: Promise<string | null> | null = null;
let initialized = false;

/** 안드로이드 13 (API 33)+ 의 POST_NOTIFICATIONS 권한 요청 */
async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
    return granted === PermissionsAndroid.RESULTS.GRANTED || granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
  } catch (e) {
    console.warn('[FCM] android notification permission request failed', e);
    return false;
  }
}

/** iOS/Android(FCM) 알림 권한 요청 */
async function requestPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        console.warn('[FCM] iOS notification permission not granted', authStatus);
      }
      return enabled;
    } else {
      // Android: FCM 자체는 별도 권한 없이 작동하지만 알림 표시 위해 Android 13+ 에서 권한 필요
      return await requestAndroidNotificationPermission();
    }
  } catch (e) {
    console.warn('[FCM] permission request error', e);
    return false;
  }
}

/** FCM 토큰을 가져온다 (캐시 사용). forceRefresh=true 시 새 토큰 요청 */
export async function getFcmToken(forceRefresh: boolean = false): Promise<string | null> {
  if (!forceRefresh && cachedToken) return cachedToken;
  if (requesting) {
    return requesting; // 이미 진행 중인 요청 재사용
  }
  requesting = (async () => {
    try {
      const token = await messaging().getToken();
      cachedToken = token;
      return token;
    } catch (e) {
      console.warn('[FCM] getToken failed', e);
      return null;
    } finally {
      requesting = null;
    }
  })();
  return requesting;
}

/** 초기화: 권한 요청 + 토큰 확보 + 토큰 리프레시 구독 */
export async function initFcm(): Promise<string | null> {
  if (!initialized) {
    initialized = true;
    // 토큰 리프레시 리스너 등록
    messaging().onTokenRefresh((token) => {
      cachedToken = token;
      console.log('[FCM] token refreshed');
    });

    // 포그라운드 메시지 핸들링 (필요시 UI 처리 추가)
    messaging().onMessage(async (remoteMessage) => {
      console.log('[FCM] foreground message', remoteMessage?.messageId, remoteMessage?.data);
      // TODO: In-app 알림 배너 표시 등 커스텀 처리 가능
    });
  }

  await requestPermission();
  const token = await getFcmToken();
  if (!token) {
    console.warn('[FCM] no token acquired');
  } else {
    console.log('[FCM] token acquired', token.substring(0, 12) + '...');
  }
  return token;
}

/** 강제로 토큰을 새로 발급(리프레시) */
export async function refreshFcmToken(): Promise<string | null> {
  return getFcmToken(true);
}

/** 캐시된 토큰 조회 (비동기 호출 없이) */
export function peekFcmToken(): string | null {
  return cachedToken;
}

