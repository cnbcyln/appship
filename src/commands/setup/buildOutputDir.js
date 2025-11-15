const chalk = require('chalk');
const { input } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { ensureConfigFile, readConfig, updateConfig } = require('../../utils/config');

async function handleBuildOutputDir(options = {}) {
  ensureConfigFile();
  const currentConfig = readConfig();

  const dir =
    options.buildOutputDir ||
    (await input({
      message: t('setup.info.buildOutputDir.prompts.buildOutputDir'),
      default: currentConfig.BUILD_OUTPUT_DIR || '',
    }));

  const normalizedDir = (dir || '').trim();
  if (!normalizedDir) {
    console.log(chalk.red(t('setup.error.buildOutputDirMissing')));
    process.exitCode = 1;
    return;
  }

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
