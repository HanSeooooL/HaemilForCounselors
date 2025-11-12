import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

export type PushInitOptions = {
  onToken?: (token: string) => Promise<void> | void; // 서버 전송 등
  onMessage?: (msg: FirebaseMessagingTypes.RemoteMessage) => void; // 커스텀 처리 (포그라운드)
};

let initialized = false;

async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Android 13+: POST_NOTIFICATIONS 권한은 자동 요청 필요
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus === 1 || settings.authorizationStatus === 2; // AUTHORIZED / PROVISIONAL
  } else {
    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  }
}

async function ensureDefaultChannel() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: 'default',
    name: '기본 알림',
    importance: AndroidImportance.HIGH,
  });
}

function displayForegroundNotification(message: FirebaseMessagingTypes.RemoteMessage) {
  const title = message.notification?.title || '알림';
  const rawBody: any = message.notification?.body ?? message.data?.body ?? '';
  const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
  notifee.displayNotification({
    title,
    body,
    android: { channelId: 'default', pressAction: { id: 'default' } },
    data: message.data,
  }).catch(() => {});
}

export async function initPush(options: PushInitOptions = {}) {
  if (initialized) return; // idempotent
  initialized = true;

  const granted = await requestNotificationPermission();
  if (!granted) {
    console.warn('[push] 알림 권한이 거부되었습니다');
  }

  await ensureDefaultChannel();

  // FCM 토큰 획득
  try {
    const token = await messaging().getToken();
    if (token) {
      console.log('[push] FCM token', token.slice(0, 12) + '...');
      await options.onToken?.(token);
    }
  } catch (e) {
    console.error('[push] FCM 토큰 획득 실패', e);
  }

  // 토큰 갱신 리스너
  messaging().onTokenRefresh(async (token) => {
    console.log('[push] FCM token refreshed');
    await options.onToken?.(token);
  });

  // 포그라운드 메시지 처리
  messaging().onMessage(async (remoteMessage) => {
    console.log('[push] foreground message', remoteMessage.messageId);
    if (options.onMessage) options.onMessage(remoteMessage);
    else displayForegroundNotification(remoteMessage);
  });

  // 백그라운드 메시지 핸들러 (전역 등록 필요)
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[push] background message', remoteMessage.messageId);
    // 최소 처리: 로그만. 필요시 데이터 저장.
  });

  // Notifee 이벤트 (사용자가 알림 탭 등)
  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      console.log('[push] notification press', detail.notification?.id);
      // 네비게이션 등 추가 처리 가능
    }
  });

  console.log('[push] 초기화 완료');
}

// Jest 환경에서 네이티브 모듈 없는 경우를 위해 가드 추가 (선택적)
export function isPushInitialized() {
  return initialized;
}
