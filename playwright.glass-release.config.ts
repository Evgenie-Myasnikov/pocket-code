import {defineConfig} from '@playwright/test';
import base from './playwright.config';

// Exercise emitted CSS: the development server does not run CSS minification.
export default defineConfig({
 ...base,
 testMatch:['**/glass-material.spec.ts','**/glass-backdrop.spec.ts'],
 webServer:[
  {command:'npx vite preview --host 127.0.0.1 --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:false},
  {command:'npx tsx tests/fixture.ts',url:'http://127.0.0.1:4319/ready',reuseExistingServer:false},
 ],
});
