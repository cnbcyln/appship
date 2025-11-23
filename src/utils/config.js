const fs = require('fs');
const path = require('path');

// Lazy load i18n to avoid circular dependency (i18n depends on config)
function getT() {
  try {
    return require('../i18n').t;
  } catch {
    // Fallback if i18n is not available yet
    return (key, replacements) => {
      if (key === 'common.errors.configReadFailed') {
        return `Failed to read configuration file (${replacements?.path || ''}): ${replacements?.message || ''}`;
      }
      if (key === 'common.errors.configWriteFailed') {
        return `Failed to write configuration file (${replacements?.path || ''}): ${replacements?.message || ''}`;
      }
      return key;
    };
  }
}

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
    const t = getT();
    throw new Error(t('common.errors.configReadFailed', { path: filePath, message: error.message }));
  }
}

function writeConfig(config) {
  const filePath = getConfigPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  } catch (error) {
    const t = getT();
    throw new Error(t('common.errors.configWriteFailed', { path: filePath, message: error.message }));
  }
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

  const normalized = value.replace(/_/g, '-').trim();
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
