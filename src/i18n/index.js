const path = require('path');
const i18n = require('i18n');
const { ensureLanguageValue } = require('../utils/config');

i18n.configure({
  locales: ['en', 'tr'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'en',
  autoReload: false,
  updateFiles: false,
  syncFiles: false,
  objectNotation: true,
  register: global,
});

function initI18n() {
  const language = ensureLanguageValue();
  setLocale(language);
  return i18n;
}

function t(key, replacements) {
  if (replacements) {
    return i18n.__mf(key, replacements);
  }
  return i18n.__mf(key);
}

function setLocale(language) {
  const available = i18n.getLocales();
  const locale = available.includes(language) ? language : 'en';
  i18n.setLocale(locale);
  return locale;
}

module.exports = {
  initI18n,
  t,
  i18n,
  setLocale,
};
