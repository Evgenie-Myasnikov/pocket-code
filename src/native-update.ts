import {registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import type {Update} from './release-update';
import type {Connection} from './api';
export const Installer=registerPlugin<{
  info():Promise<{version:string;versionCode:number}>;
  identity():Promise<{installation?:string;name:string;model:string}>;
  download(options:Update&Connection):Promise<void>;
  downloadRelease(options:Pick<Update,'version'|'sha256'|'size'|'versionCode'>):Promise<void>;
  install(options:Pick<Update,'sha256'|'versionCode'>):Promise<{needsPermission:boolean}>;
  allowInstall():Promise<void>;
  openDocument(options:{data:string;name:string}):Promise<void>;
  addListener(event:'downloadProgress',listener:(progress:{bytes:number;total:number})=>void):Promise<PluginListenerHandle>;
}>('AppUpdate');
