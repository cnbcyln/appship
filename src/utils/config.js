const fs = require('fs');
const path = require('path');

const CONFIG_FILENAME = 'appship.config.json';

const DEFAULT_CONFIG = {
  LANGUAGE: '',
  PROJECT_NAME: '',
  GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH: '',
  GOOGLE_PLAY_PACKAGE_NAME: '',
  APPLE_API_KEY_PATH: '',
  APPLE_API_KEY_ID: '',
  APPLE_API_ISSUER_ID: '',
  APPLE_TEAM_ID: '',
  APPLE_BUNDLE_ID: '',
  RELEASE_NOTES_TR: '',
  RELEASE_NOTES_EN: '',
  BUILD_OUTPUT_DIR: '',
};

function getConfigPath() {
  return path.resolve(process.cwd(), CONFIG_FILENAME);
}

function readConfig() {
  const filePath = getConfigPath();
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch (error) {
    throw new Error(`Konfigürasyon dosyası okunamadı (${filePath}): ${error.message}`);
  }
}

function writeConfig(config) {
  const filePath = getConfigPath();
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function ensureConfigFile() {
  const filePath = getConfigPath();
  if (fs.existsSync(filePath)) {
    return readConfig();
  }

  const initialConfig = { ...DEFAULT_CONFIG };
  writeConfig(initialConfig);
  return initialConfig;
}

function updateConfig(partial) {
  const current = ensureConfigFile();
  const next = normalizeConfig({ ...current, ...partial });
  writeConfig(next);
  return next;
}

function normalizeConfig(config) {
  return { ...DEFAULT_CONFIG, ...config };
}

function getSystemLanguage() {
  const intlLocale = getIntlLocale();
  if (intlLocale) {
    return mapToShortCode(intlLocale);
  }

  const candidates = [
    extractLocale(process.env.LC_ALL),
    extractLocale(process.env.LANG),
    extractLocale(process.env.LANGUAGE),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return mapToShortCode(candidate);
    }
  }

  return 'en';
}

function getIntlLocale() {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return null;
  }

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    return sanitizeLocale(resolved.locale);
  } catch (error) {
    return null;
  }
}

function extractLocale(value) {
  if (!value) {
    return null;
  }

  const cleaned = value.split('.')[0].trim();
  return sanitizeLocale(cleaned);
}

function sanitizeLocale(value) {
  if (!value) {
    return null;
  }

  const normalized = value.replace('_', '-').trim();
  if (!normalized) {
    return null;
  }

  const upper = normalized.toUpperCase();
  if (upper === 'C' || upper === 'POSIX') {
    return null;
  }

  return normalized;
}

function mapToShortCode(locale) {
  if (!locale) {
    return 'en';
  }

  const normalized = locale.toLowerCase();
  if (normalized.startsWith('tr')) {
    return 'tr';
  }

  if (normalized.startsWith('en')) {
    return 'en';
  }

  const hyphenIndex = normalized.indexOf('-');
  if (hyphenIndex > 0) {
    return normalized.slice(0, hyphenIndex);
  }

  return normalized || 'en';
}

function ensureLanguageValue() {
  const config = ensureConfigFile();
  const normalized = mapToShortCode(config.LANGUAGE);
  if (normalized && normalized === config.LANGUAGE) {
    return normalized;
  }

  if (normalized && normalized !== config.LANGUAGE) {
    updateConfig({ LANGUAGE: normalized });
    return normalized;
  }

  const detected = getSystemLanguage();
  updateConfig({ LANGUAGE: detected });
  return detected;
}

module.exports = {
  CONFIG_FILENAME,
  DEFAULT_CONFIG,
  getConfigPath,
  readConfig,
  writeConfig,
  ensureConfigFile,
  updateConfig,
  normalizeConfig,
  ensureLanguageValue,
};
