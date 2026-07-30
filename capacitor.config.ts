import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.renty.app',
  appName: 'RENTY',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'toyyibpay.com',
      '*.toyyibpay.com',
      'wa.me',
      'api.whatsapp.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#556B2F',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
  ios: {
    scheme: 'renty',
    contentInset: 'always',
  },
  android: {
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'renty',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
};

export default config;