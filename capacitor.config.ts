import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.pocketcode.mobile', appName: 'Pocket Code', webDir: 'dist',
  android: { allowMixedContent: true, backgroundColor: '#101412' },
  plugins: { SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'contain' } },
};
export default config;
