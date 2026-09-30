import type { ChatMessage } from '../server/types';
export const demoSessions = [
  { sessionId: 'demo-1', summary: 'Новый взгляд на главную страницу', cwd: 'D:\\Projects\\my-app', lastModified: Date.now(), gitBranch: 'feature/home' },
  { sessionId: 'demo-2', summary: 'Разобраться с авторизацией', cwd: 'D:\\Projects\\my-app', lastModified: Date.now() - 3700000, gitBranch: 'main' },
  { sessionId: 'demo-3', summary: 'План небольшого приложения', cwd: 'D:\\Projects\\weekend', lastModified: Date.now() - 86400000, gitBranch: 'main' },
];
export const demoMessages: ChatMessage[] = [
  { id: '1', role: 'user', blocks: [{ type: 'text', text: 'Посмотри главную страницу. Как сделать её проще и удобнее на телефоне?' }] },
  { id: '2', role: 'assistant', blocks: [{ type: 'text', text: 'Посмотрю структуру страницы и стили. Начну с того, что пользователь видит на небольшом экране.' }, { type: 'tool_use', name: 'Read', input: { file_path: 'src/pages/Home.tsx' } }] },
  { id: '3', role: 'assistant', blocks: [{ type: 'text', text: 'На главной сейчас несколько одинаково заметных действий. Предлагаю оставить **один ясный следующий шаг**.\n\n1. Убрать второстепенные ссылки в меню.\n2. Сделать карточки в одну колонку.\n3. Закрепить основное действие внизу экрана.\n\nДля сетки достаточно небольшого изменения:\n\n```css\n.projects {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 16px;\n}\n```\n\nНачнём с мобильной версии?' }] },
];
