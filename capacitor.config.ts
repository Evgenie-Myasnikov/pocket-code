import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.pocketcode.mobile', appName: 'Pocket Code', webDir: 'dist',
  android: { allowMixedContent: true, backgroundColor: '#111512' },
  plugins: { SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' } },
};
export default config;
