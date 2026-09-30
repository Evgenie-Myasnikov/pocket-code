import {registerPlugin} from '@capacitor/core';
import type {Update} from '../server/updates';
import type {Connection} from './api';
export const Installer=registerPlugin<{
  info():Promise<{version:string;versionCode:number}>;
  download(options:Update&Connection):Promise<void>;
  install(options:Pick<Update,'sha256'|'versionCode'>):Promise<{needsPermission:boolean}>;
  allowInstall():Promise<void>;
  openDocument(options:{data:string;name:string}):Promise<void>;
}>('AppUpdate');
