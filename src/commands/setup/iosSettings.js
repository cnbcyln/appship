const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { search, confirm } = require('@inquirer/prompts');
const { updateConfig, readConfig, ensureConfigFile } = require('../../utils/config');
const { t } = require('../../i18n');
const { promptRequiredInput } = require('../../utils/promptRequiredInput');

const MANUAL_CHOICE = '__manual__';

async function handleIosSettings(options = {}) {
  ensureConfigFile();

  const currentConfig = readConfig();
  const defaults = findDefaultIosSettings();

  let appleApiKeyPath = (options.appleApiKeyPath || '').trim();
  if (!appleApiKeyPath) {
    appleApiKeyPath = await resolveAppleApiKeyPath({
      existingPath: currentConfig.APPLE_API_KEY_PATH,
      defaultPath: defaults.keyPath,
      availableFiles: defaults.p8Files,
    });
  }

  const appleApiKeyId = await resolveRequiredField({
    cliValue: options.appleApiKeyId,
    defaultValue: defaults.apiKeyId,
    existingValue: currentConfig.APPLE_API_KEY_ID,
    promptMessage: t('setup.info.iosSettings.prompts.appleApiKeyId'),
    summaryFieldKey: 'appleApiKeyId',
    forcePrompt: process.stdin.isTTY && !options.appleApiKeyId,
  });

  const appleApiIssuerId = await resolveRequiredField({
    cliValue: options.appleApiIssuerId,
    defaultValue: defaults.apiIssuerId,
    existingValue: currentConfig.APPLE_API_ISSUER_ID,
    promptMessage: t('setup.info.iosSettings.prompts.appleApiIssuerId'),
    summaryFieldKey: 'appleApiIssuerId',
    forcePrompt: process.stdin.isTTY && !options.appleApiIssuerId,
  });

  const appleTeamId = await resolveRequiredField({
    cliValue: options.appleTeamId,
    defaultValue: defaults.teamId,
    existingValue: currentConfig.APPLE_TEAM_ID,
    promptMessage: t('setup.info.iosSettings.prompts.appleTeamId'),
    summaryFieldKey: 'appleTeamId',
    forcePrompt: process.stdin.isTTY && !options.appleTeamId,
  });

  const appleBundleId = await resolveRequiredField({
    cliValue: options.appleBundleId,
    defaultValue: defaults.bundleId,
    existingValue: currentConfig.APPLE_BUNDLE_ID,
    promptMessage: t('setup.info.iosSettings.prompts.appleBundleId'),
    summaryFieldKey: 'appleBundleId',
    forcePrompt: process.stdin.isTTY && !options.appleBundleId,
  });

  const normalizedKeyPath = (appleApiKeyPath || '').trim();
  const normalizedApiKeyId = (appleApiKeyId || '').trim();
  const normalizedApiIssuerId = (appleApiIssuerId || '').trim();
  const normalizedTeamId = (appleTeamId || '').trim();
  const normalizedBundleId = (appleBundleId || '').trim();

  if (!normalizedKeyPath || !normalizedApiKeyId || !normalizedApiIssuerId || !normalizedTeamId || !normalizedBundleId) {
    console.log(chalk.red(t('setup.error.iosSettingsMissingFields')));
    process.exitCode = 1;
    return;
  }

  updateConfig({
    APPLE_API_KEY_PATH: normalizedKeyPath,
    APPLE_API_KEY_ID: normalizedApiKeyId,
    APPLE_API_ISSUER_ID: normalizedApiIssuerId,
    APPLE_TEAM_ID: normalizedTeamId,
    APPLE_BUNDLE_ID: normalizedBundleId,
  });

  return {
    label: t('setup.info.iosSettings.summaryLabel'),
    value: `${normalizedBundleId}`,
    successMessage: t('setup.success.iosSettingsUpdated'),
  };
}

function registerIosSettingsCommand(setup) {
  setup
    .command('ios-settings')
    .alias('is')
    .description(t('setup.info.iosSettings.description'))
    .option('--apple-api-key-path <path>', t('setup.info.iosSettings.options.appleApiKeyPath'))
    .option('--apple-api-key-id <id>', t('setup.info.iosSettings.options.appleApiKeyId'))
    .option('--apple-api-issuer-id <id>', t('setup.info.iosSettings.options.appleApiIssuerId'))
    .option('--apple-team-id <id>', t('setup.info.iosSettings.options.appleTeamId'))
    .option('--apple-bundle-id <bundle>', t('setup.info.iosSettings.options.appleBundleId'))
    .action(async (cliOptions) => {
      const result = await handleIosSettings(cliOptions);
      if (result?.successMessage) {
        console.log(chalk.green(result.successMessage));
      }
    });
}

async function resolveAppleApiKeyPath({ existingPath, defaultPath, availableFiles }) {
  const trimmedExisting = (existingPath || '').trim();
  const trimmedDefault = (defaultPath || '').trim();

  if (!process.stdin.isTTY) {
    return trimmedExisting || trimmedDefault || '';
  }

  if (trimmedExisting) {
    const keepExisting = await confirm({
      message: t('setup.info.iosSettings.prompts.keepExistingKeyPath', { path: trimmedExisting }),
      default: true,
    });

    if (keepExisting) {
      return trimmedExisting;
    }
  }

  return promptForP8Path({
    files: availableFiles,
    fallbackDefault: trimmedExisting || trimmedDefault || '',
  });
}

async function resolveRequiredField({
  cliValue,
  defaultValue,
  existingValue,
  promptMessage,
  summaryFieldKey,
  forcePrompt = false,
}) {
  const trimmedCliValue = (cliValue || '').trim();
  if (trimmedCliValue) {
    return trimmedCliValue;
  }

  const trimmedExisting = (existingValue || '').trim();
  const trimmedDefault = (defaultValue || '').trim();
  const fallbackValue = trimmedExisting || trimmedDefault || '';

  if (!process.stdin.isTTY) {
    return fallbackValue;
  }

  if (!forcePrompt && fallbackValue) {
    return fallbackValue;
  }

  return promptRequiredInput({
    message: promptMessage,
    defaultValue: fallbackValue,
    errorMessage: t('setup.error.fieldRequired', {
      field: t(`setup.summary.fields.${summaryFieldKey}`),
    }),
  });
}

function findDefaultIosSettings() {
  const projectRoot = process.cwd();
  const iosDir = path.join(projectRoot, 'ios');
  const fastlaneDir = path.join(projectRoot, 'fastlane');
  const iosFastlaneDir = path.join(iosDir, 'fastlane');

  const defaults = {
    p8Files: collectP8Files(projectRoot, [projectRoot, iosDir, fastlaneDir, iosFastlaneDir]),
  };

  const potentialKeyFiles = [
    path.join(projectRoot, 'AuthKey_AppStoreConnect.p8'),
    path.join(projectRoot, 'AuthKey.p8'),
    path.join(projectRoot, 'apple-api-key.p8'),
    path.join(fastlaneDir, 'AuthKey_AppStoreConnect.p8'),
    path.join(iosDir, 'apple-api-key.p8'),
  ];

  for (const file of potentialKeyFiles) {
    if (fs.existsSync(file)) {
      defaults.keyPath = file;
      break;
    }
  }

  if (!defaults.keyPath && defaults.p8Files.length > 0) {
    defaults.keyPath = defaults.p8Files[0];
  }

  defaults.bundleId = extractBundleId([path.join(iosDir, 'Runner.xcodeproj', 'project.pbxproj')]) || null;
  defaults.bundleId = defaults.bundleId || extractBundleId([path.join(fastlaneDir, 'Appfile'), path.join(iosFastlaneDir, 'Appfile')]);

  const envCandidates = [
    path.join(projectRoot, '.env'),
    path.join(projectRoot, '.env.local'),
    path.join(fastlaneDir, '.env'),
    path.join(iosFastlaneDir, '.env'),
  ];

  for (const envFile of envCandidates) {
    if (!fs.existsSync(envFile)) {
      continue;
    }

    const envValues = parseEnvFile(envFile);
    defaults.apiKeyId = defaults.apiKeyId || envValues.APPLE_API_KEY_ID || envValues.APP_STORE_CONNECT_API_KEY_ID;
    defaults.apiIssuerId = defaults.apiIssuerId || envValues.APPLE_API_ISSUER_ID || envValues.APP_STORE_CONNECT_API_ISSUER_ID;
    defaults.teamId = defaults.teamId || envValues.APPLE_TEAM_ID || envValues.APP_STORE_CONNECT_TEAM_ID;
    defaults.bundleId = defaults.bundleId || envValues.APPLE_BUNDLE_ID || envValues.APP_IDENTIFIER;
  }

  return defaults;
}

function collectP8Files(projectRoot, searchRoots = []) {
  const results = [];
  const maxResults = 200;
  const maxDepth = 5;
  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    '.idea',
    '.vscode',
    'build',
    '.dart_tool',
    '.gradle',
    'Pods',
    '.ios',
    '.android',
  ]);

  const uniqueRoots = Array.from(
    new Set(
      searchRoots
        .filter(Boolean)
        .map((dir) => path.resolve(dir))
        .filter((dir) => dir.startsWith(projectRoot))
    )
  );

  for (const root of uniqueRoots) {
    traverse(root, 0);
    if (results.length >= maxResults) {
      break;
    }
  }

  return results;

  function traverse(currentDir, depth) {
    if (depth > maxDepth || results.length >= maxResults) {
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        traverse(fullPath, depth + 1);
        if (results.length >= maxResults) {
          return;
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.p8')) {
        results.push(fullPath);
        if (results.length >= maxResults) {
          return;
        }
      }
    }
  }
}

function createP8SearchSource(files, manualLabel) {
  const projectRoot = process.cwd();
  const manualChoice = { value: MANUAL_CHOICE, name: manualLabel };
  const fileChoices = files.map((file) => ({
    value: file,
    name: path.relative(projectRoot, file) || file,
  }));

  return async (term) => {
    const normalizedTerm = (term || '').toLowerCase();
    const filtered = normalizedTerm
      ? fileChoices.filter((choice) => choice.name.toLowerCase().includes(normalizedTerm))
      : fileChoices;

    return [manualChoice, ...filtered].slice(0, 10);
  };
}

async function promptForP8Path({ files, fallbackDefault }) {
  const manualLabel = t('setup.info.iosSettings.choices.enterCustomPath');
  const manualPrompt = () =>
    promptRequiredInput({
      message: t('setup.info.iosSettings.prompts.appleApiKeyPathManual'),
      defaultValue: fallbackDefault,
      errorMessage: t('setup.error.fieldRequired', {
        field: t('setup.summary.fields.appleApiKeyPath'),
      }),
    });

  const selected = await search({
    message: t('setup.info.iosSettings.prompts.appleApiKeyPathSearch'),
    source: createP8SearchSource(files, manualLabel),
    pageSize: 7,
  });

  if (!selected || selected === MANUAL_CHOICE) {
    return manualPrompt();
  }

  return selected;
}

function extractBundleId(candidateFiles = []) {
  for (const file of candidateFiles) {
    if (!file || !fs.existsSync(file)) {
      continue;
    }

    try {
      const content = fs.readFileSync(file, 'utf8');
      const pbxprojMatch = content.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([\w.\-]+);/);
      if (pbxprojMatch) {
        return pbxprojMatch[1];
      }

      const appfileMatch = content.match(/app_identifier\s+[\(\s]*["']([\w.\-]+)["']/);
      if (appfileMatch) {
        return appfileMatch[1];
      }
    } catch {
      // ignore file parsing errors
    }
  }

  return null;
}

function parseEnvFile(envPath) {
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    return lines.reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return acc;
      }

      const [key, ...rest] = trimmed.split('=');
      acc[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
      return acc;
    }, {});
  } catch {
    return {};
  }
}

module.exports = registerIosSettingsCommand;
module.exports.run = handleIosSettings;
