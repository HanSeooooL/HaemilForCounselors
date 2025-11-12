This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

## Push Notifications (FCM + Notifee)

### 1. Firebase 설정 파일 배치
- Android: `android/app/google-services.json`
- iOS: `ios/HaemilForCounseolrs/GoogleService-Info.plist` (Xcode 프로젝트에 추가되어야 함)

### 2. iOS 추가 설정
- `AppDelegate.swift` 에 `FirebaseApp.configure()` 호출되어 있어야 함.
- APNs 인증 키 또는 p12 를 Firebase 콘솔 Cloud Messaging 설정에 업로드.
- 필요 시 Info.plist 에 Background Modes (`remote-notification`) 추가.

### 3. 권한 요청 흐름
앱 최초 로그인 후 `App.tsx` 에서 FCM 초기화를 수행하며 플랫폼별 알림 권한을 요청합니다.

### 4. 서버 토큰 등록
`postDeviceToken(jwt, fcmToken)` 함수가 `/push/register` 엔드포인트로 디바이스 토큰을 전송합니다. 서버는 사용자별 최신 FCM 토큰을 저장하고 만료/갱신(onTokenRefresh) 이벤트를 반영해야 합니다.

예시 서버 저장 모델:
```json
{
  "userId": "abc123",
  "platform": "android",
  "fcmToken": "...",
  "updatedAt": "2025-11-12T10:00:00Z"
}
```

### 5. 포그라운드/백그라운드 처리
- 포그라운드: `onMessage` → 없으면 Notifee 로 기본 알림 표시.
- 백그라운드/종료: FCM data+notification payload 를 사용하여 시스템 트레이 표시.

### 6. 테스트 방법
#### Android 에뮬레이터/디바이스
```bash
adb logcat | grep FCM
```
Firebase 콘솔 혹은 curl 로 테스트 전송 (HTTP v1):
```bash
curl -X POST \\
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "Content-Type: application/json" \\
  https://fcm.googleapis.com/v1/projects/PROJECT_ID/messages:send \\
  -d '{
    "message": {
      "token": "DEVICE_FCM_TOKEN",
      "notification": { "title": "테스트", "body": "푸시 메시지" },
      "data": { "custom": "value" }
    }
  }'
```
#### iOS Simulator
- iOS 시뮬레이터는 실제 푸시 수신 불가. 실제 기기에서 테스트.

### 7. 토픽/그룹 확장 (선택)
토픽 구독:
```ts
import messaging from '@react-native-firebase/messaging';
await messaging().subscribeToTopic('weekly-updates');
```

### 8. 흔한 문제
| 증상 | 해결 |
|------|------|
| iOS 푸시 미수신 | APNs 키 누락/entitlements production 미변경 |
| 토큰 null | 권한 거부 / FirebaseApp.configure() 누락 |
| Android 알림 안 뜸 | 채널 미생성 → `default` 채널 재확인 |

### 9. 구조 요약
- 초기화: `src/ws/push.ts` (`initPush`) → App.tsx token effect
- 표시: Notifee `displayNotification`
- 서버 연동: `postDeviceToken`
