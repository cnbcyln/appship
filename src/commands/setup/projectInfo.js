const colors = require('colors/safe');
const { ensureConfigFile, updateConfig, readConfig, getConfigPath } = require('../../utils/config');
const { promptInput } = require('../../utils/prompt');
const { t } = require('../../i18n');

function registerProjectInfoCommand(setup) {
  setup
    .command('project-info')
    .description(t('setup.projectInfo.description'))
    .option('--name <name>', t('setup.projectInfo.prompt'))
    .action(async (options) => {
      ensureConfigFile();
      const currentConfig = readConfig();
      const existingName = currentConfig.PROJECT_NAME;

      const projectName =
        options.name && options.name.trim().length > 0
          ? options.name.trim()
          : await promptInput(t('setup.projectInfo.prompt'), { defaultValue: existingName });

      if (!projectName) {
        console.error(colors.red(t('setup.projectInfo.emptyError')));
        process.exitCode = 1;
        return;
      }

      updateConfig({ PROJECT_NAME: projectName });
      console.log(
        colors.green(
          t('setup.projectInfo.success', { name: projectName, path: getConfigPath() })
        )
      );
    });
}

module.exports = registerProjectInfoCommand;
