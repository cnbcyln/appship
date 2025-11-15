const chalk = require('chalk');
const { ensureConfigFile, updateConfig, readConfig } = require('../../utils/config');
const { input } = require('@inquirer/prompts');
const { t } = require('../../i18n');

async function handleProjectInfo(options = {}) {
  ensureConfigFile();
  const currentConfig = readConfig();
  const existingName = currentConfig.PROJECT_NAME;

  const projectName =
    options.name && options.name.trim().length > 0
      ? options.name.trim()
      : await input({
          message: t('setup.info.projectInfo.prompt'),
          default: existingName,
        });

  const normalizedName = (projectName || '').trim();

  if (!normalizedName) {
    console.log(chalk.red(t('setup.error.projectInfoEmpty')));
    process.exitCode = 1;
    return;
  }

  updateConfig({ PROJECT_NAME: normalizedName });

  return {
    label: t('setup.info.projectInfo.summaryLabel'),
    value: normalizedName,
    successMessage: t('setup.success.projectInfoUpdated'),
  };
}

function registerProjectInfoCommand(setup) {
  setup
    .command('project-info')
    .alias('pi')
    .description(t('setup.info.projectInfo.description'))
    .option('--name <name>', t('setup.info.projectInfo.prompt'))
    .action(async (options) => {
      const result = await handleProjectInfo(options);
      if (result?.successMessage) {
        console.log(chalk.green(result.successMessage));
      }
    });
}

module.exports = registerProjectInfoCommand;
module.exports.run = handleProjectInfo;
