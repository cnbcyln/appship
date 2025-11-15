const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { input, search, confirm } = require('@inquirer/prompts');
const { updateConfig, readConfig, ensureConfigFile } = require('../../utils/config');
const { t } = require('../../i18n');

const MANUAL_CHOICE = '__manual__';

async function handleAndroidSettings(options = {}) {
  ensureConfigFile();
  const currentConfig = readConfig();

  const defaults = findDefaultAndroidSettings();
  const manualChoiceLabel = t('setup.info.androidSettings.choices.enterCustomPath');

  let serviceAccountPath = options.googlePlayServiceAccountKeyPath;
  const existingConfigPath = currentConfig.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH || '';

  if (!serviceAccountPath && process.stdin.isTTY) {
    if (existingConfigPath) {
      const keepExisting = await confirm({
        message: t('setup.info.androidSettings.prompts.keepExistingKeyPath', { path: existingConfigPath }),
        default: true,
      });

      if (keepExisting) {
        serviceAccountPath = existingConfigPath;
      }
    }

    if (!serviceAccountPath) {
      serviceAccountPath = await promptForKeyPath(
        defaults.jsonFiles,
        manualChoiceLabel,
        existingConfigPath || defaults.keyPath || ''
      );
    }
  }

  if (!serviceAccountPath) {
    if (!process.stdin.isTTY) {
      console.log(chalk.yellow(t('setup.info.androidSettings.prompts.googlePlayServiceAccountKeyPath')));
    }
    serviceAccountPath = await input({
      message: t('setup.info.androidSettings.prompts.googlePlayServiceAccountKeyPath'),
      default: existingConfigPath || defaults.keyPath || '',
    });
  }

  const packageName =
    options.googlePlayPackageName ||
    (await input({
      message: t('setup.info.androidSettings.prompts.googlePlayPackageName'),
      default: currentConfig.GOOGLE_PLAY_PACKAGE_NAME || defaults.packageName || '',
    }));

  const normalizedKeyPath = (serviceAccountPath || '').trim();
  let normalizedPackageName = (packageName || '').trim();
  if (!normalizedPackageName && defaults.packageName) {
    normalizedPackageName = defaults.packageName;
  }

  if (!normalizedKeyPath || !normalizedPackageName) {
    console.log(chalk.red(t('setup.error.androidSettingsMissingFields')));
    process.exitCode = 1;
    return;
  }

  updateConfig({
    GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH: normalizedKeyPath,
    GOOGLE_PLAY_PACKAGE_NAME: normalizedPackageName,
  });

  return {
    label: t('setup.info.androidSettings.summaryLabel'),
    value: `${normalizedPackageName}`,
    successMessage: t('setup.success.androidSettingsUpdated'),
  };
}

function registerAndroidSettingsCommand(setup) {
  setup
    .command('android-settings')
    .alias('as')
    .description(t('setup.info.androidSettings.description'))
    .option('--google-play-service-account-key-path <path>', t('setup.info.androidSettings.options.googlePlayServiceAccountKeyPath'))
    .option('--google-play-package-name <package>', t('setup.info.androidSettings.options.googlePlayPackageName'))
    .action(async (options) => {
      const result = await handleAndroidSettings(options);
      if (result?.successMessage) {
        console.log(chalk.green(result.successMessage));
      }
    });
}

function findDefaultAndroidSettings() {
  const projectRoot = process.cwd();
  const androidDir = path.join(projectRoot, 'android');
  const iosDir = path.join(projectRoot, 'ios');

  const defaultPaths = {
    jsonFiles: collectJsonFiles(projectRoot, [projectRoot, androidDir, iosDir]),
  };

  // Service account key path heuristics
  const potentialKeyFiles = [
    path.join(androidDir, 'app', 'google-play-service-account-key.json'),
    path.join(androidDir, 'google-play-service-account-key.json'),
    path.join(projectRoot, 'google-play-service-account-key.json'),
  ];

  for (const file of potentialKeyFiles) {
    if (fs.existsSync(file)) {
      defaultPaths.keyPath = file;
      break;
    }
  }

  // Package name heuristics
  const gradleFile = path.join(androidDir, 'app', 'build.gradle');
  if (fs.existsSync(gradleFile)) {
    try {
      const content = fs.readFileSync(gradleFile, 'utf8');
      const applicationIdMatch = content.match(/applicationId\s+["']([\w.]+)["']/);
      if (applicationIdMatch) {
        defaultPaths.packageName = applicationIdMatch[1];
      }
    } catch (error) {
      // ignore
    }
  }

  // Info plist for iOS (sometimes package name equals bundle id)
  if (!defaultPaths.packageName && fs.existsSync(iosDir)) {
    const runnerPlist = path.join(iosDir, 'Runner', 'Info.plist');
    if (fs.existsSync(runnerPlist)) {
      try {
        const content = fs.readFileSync(runnerPlist, 'utf8');
        const bundIdMatch = content.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
        if (bundIdMatch) {
          defaultPaths.packageName = bundIdMatch[1];
        }
      } catch (error) {
        // ignore
      }
    }
  }

  if (!defaultPaths.keyPath && defaultPaths.jsonFiles.length > 0) {
    defaultPaths.keyPath = defaultPaths.jsonFiles[0];
  }

  return defaultPaths;
}

function collectJsonFiles(projectRoot, searchRoots = []) {
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
        .filter((dir) => dir.startsWith(projectRoot))
        .map((dir) => path.resolve(dir))
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
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        results.push(fullPath);
        if (results.length >= maxResults) {
          return;
        }
      }
    }
  }
}

function createJsonSearchSource(files, manualLabel) {
  const projectRoot = process.cwd();
  const manualChoice = { value: MANUAL_CHOICE, name: manualLabel };
  const fileChoices = files.map((file) => ({
    value: file,
    name: path.relative(projectRoot, file) || file,
  }));

  return async (term) => {
    const normalizedTerm = term ? term.toLowerCase() : '';
    const filtered = normalizedTerm
      ? fileChoices.filter((choice) => choice.name.toLowerCase().includes(normalizedTerm))
      : fileChoices;

    return [manualChoice, ...filtered].slice(0, 10);
  };
}

async function promptForKeyPath(jsonFiles, manualLabel, fallbackDefault) {
  if (jsonFiles.length > 0) {
    const selected = await search({
      message: t('setup.info.androidSettings.prompts.googlePlayServiceAccountKeyPathSearch'),
      source: createJsonSearchSource(jsonFiles, manualLabel),
      pageSize: 7,
    });

    if (selected && selected !== MANUAL_CHOICE) {
      return selected;
    }
  }

  return input({
    message: t('setup.info.androidSettings.prompts.googlePlayServiceAccountKeyPath'),
    default: fallbackDefault,
  });
}

module.exports = registerAndroidSettingsCommand;
module.exports.run = handleAndroidSettings;
