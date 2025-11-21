const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { select, confirm } = require('@inquirer/prompts');
const { ensureConfigFile, readConfig } = require('../../utils/config');
const { t } = require('../../i18n');
const { handlePromptExit } = require('../../utils/exitPrompt');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');

function registerBuildCleanCommand(program) {
  const buildClean = program
    .command('build-clean')
    .description(t('buildClean.description'))
    .option('--android', t('buildClean.options.android'))
    .option('--ios', t('buildClean.options.ios'))
    .option('--all', t('buildClean.options.all'));

  buildClean.action(async (options) => {
    while (true) {
      try {
        if (!process.stdin.isTTY && !hasTargetOption(options)) {
          console.log(chalk.red(t('buildClean.error.nonInteractive')));
          buildClean.outputHelp();
          process.exitCode = 1;
          return;
        }

        ensureConfigFile();
        const ensured = await ensureSetupPrerequisites({ platform: 'both' });
        if (!ensured) {
          console.log(chalk.yellow(t('setupFix.cancelled')));
          process.exitCode = 1;
          return;
        }
        const config = ensured || readConfig();
        const baseDir = (config.BUILD_OUTPUT_DIR || '').trim();
        if (!baseDir) {
          console.log(chalk.red(t('buildClean.error.outputDirMissing')));
          process.exitCode = 1;
          return;
        }

        const target = await resolveTarget(options);
        if (!target) {
          process.exitCode = 1;
          return;
        }

        const confirmed = await confirmCleanup(target);
        if (!confirmed) {
          console.log(chalk.yellow(t('buildClean.info.cancelled')));
          break;
        }

        const cleaned = performClean(baseDir, target);
        if (!cleaned.anyRemoved) {
          console.log(chalk.yellow(t('buildClean.info.nothing')));
        } else {
          const label = target === 'all' ? t('buildClean.menu.both') : target === 'android' ? t('buildClean.menu.android') : t('buildClean.menu.ios');
          console.log(chalk.green(t('buildClean.success.cleaned', { target: label })));
        }
        break;
      } catch (error) {
        const handled = await handlePromptExit(error);
        if (handled === 'resume') {
          continue;
        }
        if (!handled) {
          throw error;
        }
        break;
      }
    }
  });

  return program;
}

module.exports = registerBuildCleanCommand;

function hasTargetOption(options = {}) {
  return options.android || options.ios || options.all;
}

async function resolveTarget(options = {}) {
  if (options.all) return 'all';
  if (options.android && options.ios) return 'all';
  if (options.android) return 'android';
  if (options.ios) return 'ios';

  const choice = await select({
    message: t('buildClean.menu.prompt'),
    choices: [
      { value: 'android', name: t('buildClean.menu.android') },
      { value: 'ios', name: t('buildClean.menu.ios') },
      { value: 'all', name: t('buildClean.menu.both') },
    ],
  });
  return choice;
}

function performClean(baseDir, target) {
  const removed = [];
  const candidates = [];

  const androidDir = path.join(baseDir, 'android');
  const iosDir = path.join(baseDir, 'ios');

  if (target === 'all') {
    candidates.push(baseDir);
  } else if (target === 'android') {
    candidates.push(androidDir);
  }
  if (target === 'ios') {
    candidates.push(iosDir);
  }

  const unique = Array.from(new Set(candidates.map((p) => path.resolve(p))));
  unique.forEach((dir) => {
    if (dir === path.parse(dir).root) {
      return;
    }
    if (fs.existsSync(dir)) {
      try {
        const stats = fs.statSync(dir);
        if (stats.isDirectory()) {
          const entries = fs.readdirSync(dir);
          if (entries.length === 0) {
            return;
          }
          fs.rmSync(dir, { recursive: true, force: true });
          fs.mkdirSync(dir, { recursive: true });
        } else {
          fs.rmSync(dir, { force: true });
        }
        removed.push(dir);
      } catch {
        // ignore failures silently
      }
    }
  });

  return { anyRemoved: removed.length > 0, removed };
}

async function confirmCleanup(target) {
  const mapping = {
    android: t('buildClean.menu.android'),
    ios: t('buildClean.menu.ios'),
    all: t('buildClean.menu.both'),
  };

  const label = mapping[target] || target;
  return confirm({
    message: t('buildClean.menu.confirm', { target: label }),
    default: true,
  });
}
