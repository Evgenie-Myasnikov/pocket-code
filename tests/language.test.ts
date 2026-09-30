import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLanguage, setLanguage, t } from '../src/i18n';

test('English default, Russian switching, dynamic diagnostics and unchanged unknown content', () => {
  assert.equal(getLanguage(), 'en');
  assert.equal(t('Настройки'), 'Settings');
  assert.equal(t(' · Открыть'), ' · Open');
  assert.equal(t('Ошибка подключения ({0})', 502), 'Connection error (502)');
  assert.equal(t('Ошибка подключения (502)'), 'Connection error (502)');
  setLanguage('ru');
  assert.equal(t('Settings'), 'Настройки');
  assert.equal(t('Connection error (502)'), 'Ошибка подключения (502)');
  assert.equal(t('Unrelated text — untouched'), 'Unrelated text — untouched');
  setLanguage('en');
});
