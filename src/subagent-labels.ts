import {getLanguage} from './i18n';

const labels = {
  agents:['Agents','Субагенты'], back:['All agents','Все субагенты'], close:['Back to chat','Вернуться в чат'],
  refresh:['Refresh','Обновить'], loading:['Loading agents…','Загружаем субагентов…'],
  empty:['No agents in this chat yet.','В этом чате пока нет субагентов.'],
  note:['Read-only activity from this chat','Действия субагентов этого чата · только просмотр'],
  task:['Task','Задание'], result:['Result','Результат'], messages:['Messages','Сообщения'],
  historyLoading:['Loading messages…','Загружаем сообщения…'],
  noHistory:['No separate messages are available yet.','Отдельные сообщения пока недоступны.'],
  historyError:['Could not refresh messages. The task and result remain below.','Не удалось обновить сообщения. Задание и результат доступны ниже.'],
  listError:['Could not refresh agents.','Не удалось обновить субагентов.'],
  details:['Connection details','Подробности подключения'],
  running:['Working','Работает'], completed:['Completed','Завершено'], error:['Needs attention','Нужна проверка'],
  stopped:['Stopped','Остановлен'], unknown:['Status unavailable','Статус недоступен'],
} as const;
export type SubagentLabel=keyof typeof labels;
export const agentLabel=(key:SubagentLabel)=>labels[key][getLanguage()==='ru'?1:0];
