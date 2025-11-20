const chalk = require('chalk');
const { ensureConfigFile, updateConfig, readConfig } = require('../../utils/config');
const { t } = require('../../i18n');
const { promptRequiredInput } = require('../../utils/promptRequiredInput');

async function handleProjectInfo(options = {}) {
  ensureConfigFile();
  const currentConfig = readConfig();
  const existingName = currentConfig.PROJECT_NAME || '';
  let projectName = options.name && options.name.trim();
  if (!projectName) {
    projectName = await promptRequiredInput({
      message: t('setup.info.projectInfo.prompt'),
      defaultValue: existingName,
      errorMessage: t('setup.error.projectInfoEmpty'),
    });
  }

  const normalizedName = (projectName || '').trim();

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
