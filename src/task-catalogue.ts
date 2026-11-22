export type CatalogueSection='providers'|'accounts'|'executors';
export type TextProviderIssue={provider:'claude'|'codex'|'copilot';reason:'not_detected'|'signed_out'|'unknown'|'runtime'|'version'};
const messages={
  providers:['Не удалось проверить вход в локальные провайдеры на ПК.','Could not check local provider sign-in on the PC.'],
  accounts:['Не удалось прочитать сохранённые API-подключения на ПК.','Could not read saved API connections on the PC.'],
  executors:['Не удалось проверить часть исполнителей задач.','Some task executors could not be checked.'],
};
export function catalogueWarning(warnings:readonly CatalogueSection[]|undefined,ru:boolean){
  const valid:readonly CatalogueSection[]=Array.isArray(warnings)?warnings:[];
  return valid.filter(key=>Object.hasOwn(messages,key)).map(key=>messages[key][ru?0:1]).join(' ');
}
export function providerIssueText(reason:TextProviderIssue['reason'],ru:boolean){
  const reasons={
    not_detected:['CLI не обнаружен на ПК','CLI not found on this PC'],
    signed_out:['требуется вход на ПК','sign-in required on this PC'],
    unknown:['не удалось проверить подключение','connection could not be verified'],
    runtime:['локальный сервис недоступен','local service is unavailable'],
    version:['нужен Codex CLI 0.171.0 или новее','requires Codex CLI 0.171.0 or newer'],
  };
  return (reasons[reason]||reasons.unknown)[ru?0:1];
}
