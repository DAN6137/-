import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yair.app',
  appName: 'Yair App',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
