import {completeName,type ProfileName} from './profile-name';
export function savedProfile():ProfileName|null{try{const profile=JSON.parse(localStorage.getItem('pocket-own-profile')||'null');return profile&&typeof profile.firstName==='string'&&typeof profile.lastName==='string'&&completeName(profile)?profile:null;}catch{return null;}}
export function saveProfile(profile:ProfileName){if(completeName(profile))try{localStorage.setItem('pocket-own-profile',JSON.stringify(profile));}catch{}}
