export type ProfileName={firstName:string;lastName:string};
export function profileName(value:{name?:string;firstName?:string;lastName?:string}|undefined):ProfileName{
 const words=(value?.name||'').trim().split(/\s+/);return {firstName:value?.firstName??words[0]??'',lastName:value?.lastName??words.slice(1).join(' ')};
}
export function completeName(value:ProfileName){return !!value.firstName.trim()&&!!value.lastName.trim();}
