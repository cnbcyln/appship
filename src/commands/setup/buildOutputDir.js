const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { search, confirm } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { ensureConfigFile, readConfig, updateConfig } = require('../../utils/config');
const { promptRequiredInput } = require('../../utils/promptRequiredInput');

const MANUAL_CHOICE = '__manual__';

async function handleBuildOutputDir(options = {}) {
  ensureConfigFile();
  const projectRoot = process.cwd();
  const currentConfig = readConfig();
  const defaults = findDefaultBuildOutputDir();
  const existingDir = (currentConfig.BUILD_OUTPUT_DIR || '').trim();
  let resolvedExistingDir = existingDir && fs.existsSync(existingDir) ? existingDir : '';
  const preferredOutputDir = defaults.preferredOutputDir;

  let dir = (options.buildOutputDir || '').trim();

  if (!dir && existingDir && process.stdin.isTTY) {
    if (fs.existsSync(existingDir)) {
      const absoluteExisting = path.resolve(existingDir);
      const keepExisting = await confirm({
        message: t('setup.info.buildOutputDir.prompts.useConfiguredOutputDir', { path: absoluteExisting }),
        default: true,
      });
      if (keepExisting) {
        ensureDirectoryExists(existingDir);
        dir = existingDir;
        resolvedExistingDir = existingDir;
      }
    } else {
      const absoluteExisting = path.resolve(existingDir);
      const createExisting = await confirm({
        message: t('setup.info.buildOutputDir.prompts.useExistingOutputDir', { path: absoluteExisting }),
        default: true,
      });
      if (createExisting) {
        ensureDirectoryExists(existingDir);
        dir = existingDir;
        resolvedExistingDir = existingDir;
      }
    }
  }

  if (!dir && process.stdin.isTTY) {
    if (!existingDir && preferredOutputDir) {
      const relativePath = path.relative(projectRoot, preferredOutputDir) || preferredOutputDir;
      const absolutePath = path.resolve(preferredOutputDir);
      const usePreferred = await confirm({
        message: t('setup.info.buildOutputDir.prompts.useDefaultOutputDir', { path: absolutePath }),
        default: true,
      });

      if (usePreferred) {
        ensureDirectoryExists(preferredOutputDir);
        dir = preferredOutputDir;
      }
    }

    if (!dir) {
      dir = await promptForBuildOutputDir({
        directories: defaults.directories,
        fallbackDefault: resolvedExistingDir || defaults.defaultDir || preferredOutputDir || '',
      });
    }
  }

  if (!dir) {
    dir = await promptRequiredInput({
      message: t('setup.info.buildOutputDir.prompts.buildOutputDirManual'),
      defaultValue: resolvedExistingDir || defaults.defaultDir || preferredOutputDir || '',
      errorMessage: t('setup.error.buildOutputDirMissing'),
    });
  }

  const normalizedDir = (dir || '').trim();

  updateConfig({ BUILD_OUTPUT_DIR: normalizedDir });

  return {
    label: t('setup.info.buildOutputDir.summaryLabel'),
    value: normalizedDir,
    successMessage: t('setup.success.buildOutputDirUpdated'),
  };
}

function registerBuildOutputDirCommand(setup) {
  setup
    .command('build-output-dir')
    .alias('bo')
    .description(t('setup.info.buildOutputDir.description'))
    .option('--build-output-dir <dir>', t('setup.info.buildOutputDir.options.buildOutputDir'))
    .action(async (options) => {
      const result = await handleBuildOutputDir(options);
      if (result?.successMessage) {
        console.log(chalk.green(result.successMessage));
      }
    });
}

module.exports = registerBuildOutputDirCommand;
module.exports.run = handleBuildOutputDir;

async function promptForBuildOutputDir({ directories, fallbackDefault }) {
  const manualLabel = t('setup.info.buildOutputDir.choices.enterCustomDir');
  const manualPrompt = () =>
    promptRequiredInput({
      message: t('setup.info.buildOutputDir.prompts.buildOutputDirManual'),
      defaultValue: fallbackDefault,
      errorMessage: t('setup.error.buildOutputDirMissing'),
    });

  const selected = await search({
    message: t('setup.info.buildOutputDir.prompts.buildOutputDirSearch'),
    source: createDirectorySearchSource(directories, manualLabel),
    pageSize: 7,
  });

  if (!selected || selected === MANUAL_CHOICE) {
    return manualPrompt();
  }

  return selected;
}

function createDirectorySearchSource(directories, manualLabel) {
  const projectRoot = process.cwd();
  const manualChoice = { value: MANUAL_CHOICE, name: manualLabel };
  const dirChoices = directories.map((dir) => ({
    value: dir,
    name: path.relative(projectRoot, dir) || dir,
  }));

  return async (term) => {
    const normalizedTerm = (term || '').toLowerCase();
    const filtered = normalizedTerm
      ? dirChoices.filter((choice) => choice.name.toLowerCase().includes(normalizedTerm))
      : dirChoices;

    return [manualChoice, ...filtered].slice(0, 10);
  };
}

function findDefaultBuildOutputDir() {
  const projectRoot = process.cwd();
  const preferredOutputDir = path.join(projectRoot, 'output');
  const knownCandidates = [
    path.join(projectRoot, 'build', 'app', 'outputs'),
    path.join(projectRoot, 'build', 'outputs'),
    path.join(projectRoot, 'build'),
    path.join(projectRoot, 'dist'),
    preferredOutputDir,
    path.join(projectRoot, 'outputs'),
  ];

  const defaultDirCandidate = knownCandidates.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
  const directories = collectDirectories(projectRoot, projectRoot, 4);

  if (defaultDirCandidate && !directories.includes(defaultDirCandidate)) {
    directories.unshift(defaultDirCandidate);
  }

  return {
    defaultDir: defaultDirCandidate || preferredOutputDir,
    preferredOutputDir,
    directories,
  };
}

function collectDirectories(projectRoot, startDir, maxDepth) {
  const results = [];
  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    '.idea',
    '.vscode',
    '.dart_tool',
    '.gradle',
    'Pods',
    '.ios',
    '.android',
  ]);

  traverse(startDir, 0);
  return results;

  function traverse(currentDir, depth) {
    if (depth > maxDepth || results.length >= 200) {
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
      if (!entry.isDirectory()) {
        continue;
      }

      if (ignoredDirs.has(entry.name)) {
        continue;
      }

      results.push(fullPath);
      traverse(fullPath, depth + 1);

      if (results.length >= 200) {
        return;
      }
    }
  }
}

function ensureDirectoryExists(dirPath) {
  if (!dirPath) {
    return;
  }

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
