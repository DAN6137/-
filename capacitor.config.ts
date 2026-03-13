import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yair.hebrewfixer',
  appName: 'Hebrew Name Fixer',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
