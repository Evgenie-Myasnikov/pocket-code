import type {LucideIcon} from 'lucide-react';
import {Bell,Bot,Download,Gauge,Info,Laptop,LayoutDashboard,Monitor,Palette,Smartphone,Ticket} from 'lucide-react';

/** One list of settings sections for the phone and the Windows window. Shells differ in layout only; a section missing on one platform says why. */
export type SettingsPlatform='phone'|'desktop';
export type SettingsGroupId='pc'|'agents'|'device'|'integrations'|'about';
export type SettingsCategoryId='connection'|'updates'|'system'|'workspace'|'usage'|'appearance'|'notifications'|'miro'|'jira'|'about';
export type SettingsCategory={id:SettingsCategoryId;group:SettingsGroupId;title:string;hint:string;icon:Partial<Record<SettingsPlatform,LucideIcon>>&{default:LucideIcon};titles?:Partial<Record<SettingsPlatform,string>>;hints?:Partial<Record<SettingsPlatform,string>>;storage?:string;platforms:SettingsPlatform[];reasonIfMissing?:string};
export const settingsGroups:{id:SettingsGroupId;title:string}[]=[
  {id:'pc',title:'ПК'},
  {id:'agents',title:'Агенты'},
  {id:'device',title:'Это устройство'},
  {id:'integrations',title:'Интеграции'},
  {id:'about',title:'О приложении'},
];
export const settingsCategories:SettingsCategory[]=[
  {id:'connection',group:'pc',title:'Подключение к ПК',titles:{desktop:'Подключение'},hint:'QR и подключённый компьютер',hints:{desktop:'QR, подключение телефона и устройства'},icon:{default:Laptop,desktop:Smartphone},storage:'Ключ подключения хранится на этом устройстве',platforms:['phone','desktop']},
  {id:'updates',group:'pc',title:'Обновления',hint:'Версия приложения и установка обновлений',hints:{desktop:'Windows, хост ПК и Android'},icon:{default:Download},platforms:['phone','desktop']},
  {id:'system',group:'pc',title:'Приложение Windows',hint:'Автозапуск, трей и переподключение',icon:{default:Monitor},storage:'Хранится на этом ПК',platforms:['desktop'],reasonIfMissing:'Автозапуск и трей есть только у приложения Windows'},
  {id:'workspace',group:'agents',title:'Аккаунты AI',hint:'Аккаунт, доступ и параметры чата',icon:{default:Bot},storage:'Вход — на ПК; режим доступа и лимит стоимости — на этом устройстве',platforms:['phone','desktop']},
  {id:'usage',group:'agents',title:'Лимиты использования',hint:'Оставшийся лимит и время сброса',icon:{default:Gauge},storage:'Лимиты аккаунта провайдера, общие для всех устройств',platforms:['phone','desktop']},
  {id:'appearance',group:'device',title:'Оформление и язык',hint:'Тема, цвета и размер текста',icon:{default:Palette},storage:'Хранится на этом устройстве',platforms:['phone','desktop']},
  {id:'notifications',group:'device',title:'Уведомления',hint:'Завершение, ошибки и вопросы агента',icon:{default:Bell},storage:'Хранится на этом устройстве',platforms:['phone','desktop']},
  {id:'miro',group:'integrations',title:'Miro',hint:'Подключение досок проектов',icon:{default:LayoutDashboard},storage:'Привязка досок хранится на ПК',platforms:['phone','desktop']},
  {id:'jira',group:'integrations',title:'Jira',hint:'Подключение к сервису задач',icon:{default:Ticket},storage:'Подключение хранится на ПК',platforms:['phone'],reasonIfMissing:'Вход в Jira — только в Android-приложении'},
  {id:'about',group:'about',title:'О приложении',hint:'Pocket Code',icon:{default:Info},platforms:['phone','desktop']},
];
export const categoryTitle=(category:SettingsCategory,platform:SettingsPlatform)=>category.titles?.[platform]||category.title;
export const categoryHint=(category:SettingsCategory,platform:SettingsPlatform)=>category.hints?.[platform]||category.hint;
export const categoryIcon=(category:SettingsCategory,platform:SettingsPlatform)=>category.icon[platform]||category.icon.default;
export function categoriesFor(platform:SettingsPlatform,hidden:SettingsCategoryId[]=[]){return settingsCategories.filter(item=>item.platforms.includes(platform)&&!hidden.includes(item.id));}
/** Categories grouped in registry order; empty groups are dropped. */
export function groupedCategories(platform:SettingsPlatform,hidden:SettingsCategoryId[]=[]){const visible=categoriesFor(platform,hidden);return settingsGroups.map(group=>({...group,items:visible.filter(item=>item.group===group.id)})).filter(group=>group.items.length);}
