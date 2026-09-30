import { t } from "./i18n";export function networkFailure(url: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || '');
  if (/cleartext|not permitted.*network/i.test(message)) return t("Android заблокировал HTTP. Используйте интернет QR с HTTPS или обновите приложение.");
  if (/ssl|certificate|certpath|trust anchor/i.test(message)) return t("Не удалось проверить HTTPS-сертификат. Проверьте дату телефона и используйте свежий QR сервера.");
  const host = new URL(url).hostname;
  if (/^100\./.test(host)) return t("VPN-адрес ПК недоступен. Адрес 100.x не обязательно принадлежит Tailscale. Для мобильного интернета запустите на ПК Start Pocket Code Internet.cmd и отсканируйте новый HTTPS QR.");
  if (/^(192\.168\.|10\.|172\.)/.test(host)) return t("Этот адрес работает только в домашней сети ПК. Подключитесь к тому же Wi-Fi или запустите на ПК Start Pocket Code Internet.cmd для подключения через интернет.");
  return t("Не удалось связаться с ПК. Проверьте, что сервер и интернет-туннель запущены. После перезапуска туннеля отсканируйте новый QR и нажмите «Подключить компьютер».");
}
