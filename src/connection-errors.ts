import { t } from "./i18n";
/** One cause per failure: only an unreachable PC switches the phone to offline mode. */
export type ConnectionProblem='unreachable'|'auth'|'incompatible'|'not-pocket-code'|'tls'|'cleartext';
const tailscale=/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,lan=/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;
export function networkProblem(message:string):ConnectionProblem{return /cleartext|not permitted.*network/i.test(message)?'cleartext':/ssl|certificate|certpath|trust anchor/i.test(message)?'tls':'unreachable';}
export function networkFailure(url: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || '');
  const problem=networkProblem(message);
  if (problem==='cleartext') return t("Android заблокировал HTTP. Используйте интернет QR с HTTPS или обновите приложение.");
  if (problem==='tls') return t("Не удалось проверить HTTPS-сертификат. Проверьте дату телефона и используйте свежий QR сервера.");
  const host = new URL(url).hostname;
  if (host==='localhost'||host==='[::1]'||/^127\./.test(host)) return t("Адрес localhost работает только на самом ПК. Отсканируйте QR с адресом Wi-Fi, Tailscale или интернета.");
  if (tailscale.test(host)) return t("Адрес Tailscale недоступен. Включите Tailscale на телефоне и ПК. Для мобильного интернета без VPN включите на ПК «Подключение через интернет» и отсканируйте новый HTTPS QR.");
  if (lan.test(host)) return t("Этот адрес работает только в домашней сети ПК. Подключитесь к тому же Wi-Fi или включите на ПК «Подключение через интернет».");
  return t("Не удалось связаться с ПК. Проверьте, что сервер и интернет-туннель запущены. После перезапуска туннеля отсканируйте новый QR.");
}
export function connectionProblem(error:unknown):ConnectionProblem{
  const value=error as {problem?:ConnectionProblem;status?:number}|null;
  if(value?.problem)return value.problem;
  const status=value?.status||0;
  return status>=400&&status<500?'auth':'unreachable';
}
