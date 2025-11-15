const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { input, search } = require('@inquirer/prompts');
const { updateConfig, readConfig, ensureConfigFile } = require('../../utils/config');
const { t } = require('../../i18n');

const MANUAL_CHOICE = '__manual__';

async function handleIosSettings(options = {}) {
  ensureConfigFile();
  const currentConfig = readConfig();

  const defaults = findDefaultIosSettings();
  const manualChoiceLabel = t('setup.info.iosSettings.choices.enterCustomPath');

  let apiKeyPath = options.appleApiKeyPath;
  if (!apiKeyPath && process.stdin.isTTY) {
    apiKeyPath = await promptForKeyPath(defaults.keyFiles, manualChoiceLabel, currentConfig.APPLE_API_KEY_PATH || defaults.keyFiles[0] || '');
  }

  if (!apiKeyPath) {
    apiKeyPath = await input({
      message: t('setup.info.iosSettings.prompts.appleApiKeyPath'),
      default: currentConfig.APPLE_API_KEY_PATH || defaults.keyFiles[0] || '',
    });
  }

  const apiKeyId =
    options.appleApiKeyId ||
    (await input({
      message: t('setup.info.iosSettings.prompts.appleApiKeyId'),
      default: currentConfig.APPLE_API_KEY_ID || '',
    }));

  const issuerId =
    options.appleApiIssuerId ||
    (await input({
      message: t('setup.info.iosSettings.prompts.appleApiIssuerId'),
      default: currentConfig.APPLE_API_ISSUER_ID || '',
    }));

  const teamId =
    options.appleTeamId ||
    (await input({
      message: t('setup.info.iosSettings.prompts.appleTeamId'),
      default: currentConfig.APPLE_TEAM_ID || '',
    }));

  const bundleId =
    options.appleBundleId ||
    (await input({
      message: t('setup.info.iosSettings.prompts.appleBundleId'),
      default: currentConfig.APPLE_BUNDLE_ID || defaults.bundleId || '',
    }));

  const normalized = {
    keyPath: (apiKeyPath || '').trim(),
    keyId: (apiKeyId || '').trim(),
    issuerId: (issuerId || '').trim(),
    teamId: (teamId || '').trim(),
    bundleId: (bundleId || '').trim(),
  };

  if (!normalized.keyPath || !normalized.keyId || !normalized.issuerId || !normalized.teamId || !normalized.bundleId) {
    console.log(chalk.red(t('setup.error.iosSettingsMissingFields')));
    process.exitCode = 1;
    return;
  }

  updateConfig({
    APPLE_API_KEY_PATH: normalized.keyPath,
    APPLE_API_KEY_ID: normalized.keyId,
    APPLE_API_ISSUER_ID: normalized.issuerId,
    APPLE_TEAM_ID: normalized.teamId,
    APPLE_BUNDLE_ID: normalized.bundleId,
  });

  return {
    label: t('setup.info.iosSettings.summaryLabel'),
    value: normalized.bundleId,
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
    .option('--apple-api-issuer-id <issuer>', t('setup.info.iosSettings.options.appleApiIssuerId'))
    .option('--apple-team-id <team>', t('setup.info.iosSettings.options.appleTeamId'))
    .option('--apple-bundle-id <bundle>', t('setup.info.iosSettings.options.appleBundleId'))
    .action(async (options) => {
      const result = await handleIosSettings(options);
      if (result?.successMessage) {
        console.log(chalk.green(result.successMessage));
      }
    });
}

function findDefaultIosSettings() {
  const projectRoot = process.cwd();
  const iosDir = path.join(projectRoot, 'ios');
  const keyFiles = collectKeyFiles(projectRoot, [projectRoot, iosDir]);
  const defaults = {
    keyFiles,
    bundleId: null,
  };

  const plistPath = path.join(iosDir, 'Runner', 'Info.plist');
  if (fs.existsSync(plistPath)) {
    try {
      const content = fs.readFileSync(plistPath, 'utf8');
      const bundleMatch = content.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
      if (bundleMatch) {
        defaults.bundleId = bundleMatch[1];
      }
    } catch (error) {
      // ignore parse issues
    }
  }

  return defaults;
}

function collectKeyFiles(projectRoot, roots = []) {
  const results = [];
  const maxResults = 200;
  const maxDepth = 5;
  const ignoredDirs = new Set(['node_modules', '.git', '.idea', '.vscode', 'build', 'Pods', '.ios', '.android']);

  const normalizedRoots = Array.from(
    new Set(
      roots
        .filter(Boolean)
        .filter((dir) => dir.startsWith(projectRoot))
        .map((dir) => path.resolve(dir))
    )
  );

  for (const root of normalizedRoots) {
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

async function promptForKeyPath(files, manualLabel, fallbackDefault) {
  if (files.length > 0 && process.stdin.isTTY) {
    const selected = await search({
      message: t('setup.info.iosSettings.prompts.appleApiKeyPathSearch'),
      source: createSearchSource(files, manualLabel),
      pageSize: 7,
    });

    if (selected && selected !== MANUAL_CHOICE) {
      return selected;
    }
  }

  return input({
    message: t('setup.info.iosSettings.prompts.appleApiKeyPath'),
    default: fallbackDefault,
  });
}

function createSearchSource(files, manualLabel) {
  const projectRoot = process.cwd();
  const manualChoice = { value: MANUAL_CHOICE, name: manualLabel };
  const choices = files.map((file) => ({
    value: file,
    name: path.relative(projectRoot, file) || file,
  }));

  return async (term) => {
    const normalized = term ? term.toLowerCase() : '';
    const filtered = normalized ? choices.filter((choice) => choice.name.toLowerCase().includes(normalized)) : choices;
    return [manualChoice, ...filtered].slice(0, 10);
  };
}

module.exports = registerIosSettingsCommand;
module.exports.run = handleIosSettings;
