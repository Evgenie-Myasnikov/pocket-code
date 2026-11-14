import type {LucideIcon} from 'lucide-react';
import {Bell,Bot,Download,Laptop,LayoutDashboard,MessageSquare,Palette,Smartphone} from 'lucide-react';

/** One list of settings sections for the phone and the Windows window. Shells differ in layout only; a section missing on one platform says why. */
export type SettingsPlatform='phone'|'desktop';
export type SettingsGroupId='link'|'work'|'look';
/** 'usage', 'system', 'miro', 'jira' and 'about' are former sections: links to them open the section that took them in. */
export type SettingsCategoryId='connection'|'updates'|'system'|'workspace'|'usage'|'chat'|'board'|'appearance'|'notifications'|'miro'|'jira'|'about';
export type SettingsCategory={id:SettingsCategoryId;group:SettingsGroupId;title:string;hint:string;icon:Partial<Record<SettingsPlatform,LucideIcon>>&{default:LucideIcon};titles?:Partial<Record<SettingsPlatform,string>>;hints?:Partial<Record<SettingsPlatform,string>>;storage?:string;platforms:SettingsPlatform[];reasonIfMissing?:string};
/** Sections are named by what the person wants to do, the same on the phone and in the Windows window. */
export const settingsGroups:{id:SettingsGroupId;title:string}[]=[
  {id:'link',title:'Подключение'},
  {id:'work',title:'Агенты и доска'},
  {id:'look',title:'Интерфейс'},
];
export const settingsCategories:SettingsCategory[]=[
  {id:'connection',group:'link',title:'Подключение к ПК',titles:{desktop:'Подключение и запуск'},hint:'QR и подключённый компьютер',hints:{desktop:'QR, телефоны, автозапуск и трей'},icon:{default:Laptop,desktop:Smartphone},storage:'Ключ подключения хранится на этом устройстве',platforms:['phone','desktop']},
  {id:'updates',group:'link',title:'Обновления',hint:'Версия приложения и установка обновлений',hints:{desktop:'Windows, сервер ПК, Android и AI на ПК'},icon:{default:Download},platforms:['phone','desktop']},
  {id:'workspace',group:'work',title:'Провайдеры',hint:'Вход, доступ агента и лимиты',icon:{default:Bot},storage:'Вход — на ПК; режим доступа и лимит стоимости — на этом устройстве',platforms:['phone','desktop']},
  {id:'chat',group:'work',title:'Чат',hint:'Отправка, подтверждения, голос и скорость текста',icon:{default:MessageSquare},storage:'Хранится на этом устройстве',platforms:['phone','desktop']},
  {id:'board',group:'work',title:'Доска',hint:'Сетка, Miro и Jira',icon:{default:LayoutDashboard},storage:'Сетка — на этом устройстве; привязки досок и Jira — на ПК',platforms:['phone','desktop']},
  {id:'appearance',group:'look',title:'Оформление и язык',hint:'Тема, цвета и размер текста',icon:{default:Palette},storage:'Хранится на этом устройстве',platforms:['phone','desktop']},
  {id:'notifications',group:'look',title:'Уведомления',hint:'Завершение, ошибки и вопросы агента',icon:{default:Bell},storage:'Хранится на этом устройстве',platforms:['phone','desktop']},
];
/** A link to a former section opens the section that now holds its settings. */
export const settingsAlias:Partial<Record<SettingsCategoryId,SettingsCategoryId>>={usage:'workspace',system:'connection',miro:'board',jira:'board',about:'updates'};
export const settingsPage=<T extends string>(id:T)=>(settingsAlias[id as SettingsCategoryId]||id) as T|SettingsCategoryId;
export const categoryTitle=(category:SettingsCategory,platform:SettingsPlatform)=>category.titles?.[platform]||category.title;
export const categoryHint=(category:SettingsCategory,platform:SettingsPlatform)=>category.hints?.[platform]||category.hint;
export const categoryIcon=(category:SettingsCategory,platform:SettingsPlatform)=>category.icon[platform]||category.icon.default;
export function categoriesFor(platform:SettingsPlatform,hidden:SettingsCategoryId[]=[]){return settingsCategories.filter(item=>item.platforms.includes(platform)&&!hidden.includes(item.id));}
/** Categories grouped in registry order; empty groups are dropped. */
export function groupedCategories(platform:SettingsPlatform,hidden:SettingsCategoryId[]=[]){const visible=categoriesFor(platform,hidden);return settingsGroups.map(group=>({...group,items:visible.filter(item=>item.group===group.id)})).filter(group=>group.items.length);}
