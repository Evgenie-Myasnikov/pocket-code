import {t,getLanguage} from './i18n';

/** Picks the Russian form (one/few/many) or, in English, singular only for exactly one; each form is a translated template with {0}. */
export function plural(n:number,forms:readonly [string,string,string]){
  const ru=getLanguage()==='ru',mod10=n%10,mod100=n%100;
  const form=ru?(mod10===1&&mod100!==11?0:mod10>=2&&mod10<=4&&(mod100<12||mod100>14)?1:2):n===1?0:2;
  return t(forms[form],n);
}
