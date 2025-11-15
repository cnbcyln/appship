const chalk = require('chalk');
const { ensureConfigFile, updateConfig, readConfig } = require('../../utils/config');
const { input } = require('@inquirer/prompts');
const { t } = require('../../i18n');

function registerProjectInfoCommand(setup) {
  setup
    .command('project-info')
    .alias('pi')
    .description(t('setup.info.projectInfo.description'))
    .option('--name <name>', t('setup.info.projectInfo.prompt'))
    .action(async (options) => {
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
      console.log(
        chalk.green(
          t('setup.success.projectInfoUpdated', { name: normalizedName })
        )
      );
    });
}

module.exports = registerProjectInfoCommand;
