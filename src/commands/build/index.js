const chalk = require('chalk');
const { t } = require('../../i18n');
const { ensureConfigFile } = require('../../utils/config');
const { promptPlatformSelection, getPlatformLabelKey } = require('./platformSelection');
const { promptAndroidFormatSelection, getFormatLabelKey } = require('./androidFormats');
const { getPubspecVersionInfo, promptVersionDecision } = require('./versionPrompt');
const { handleVersionBump } = require('./versionBump');
const { runAndroidBuild } = require('./androidBuild');
const { runIosBuild } = require('./iosBuild');

function registerBuildCommand(program) {
  const build = program.command('build').description(t('build.description'));

  build.action(async () => {
    if (!process.stdin.isTTY) {
      console.log(chalk.red(t('build.error.nonInteractive')));
      build.outputHelp();
      process.exitCode = 1;
      return;
    }

    const config = ensureConfigFile();
    const platform = await promptPlatformSelection();
    console.log(chalk.cyan(t('build.platform.selection', { value: t(getPlatformLabelKey(platform)) })));

    let androidFormat = null;
    if (platform === 'android' || platform === 'both') {
      androidFormat = await promptAndroidFormatSelection();
      console.log(chalk.cyan(t('build.format.selection', { value: t(getFormatLabelKey(androidFormat)) })));
    }

    const versionInfo = getPubspecVersionInfo();
    if (versionInfo.warningKey) {
      console.log(chalk.yellow(t(versionInfo.warningKey)));
    }

    const versionDecision = await promptVersionDecision(versionInfo);
    if (versionDecision.decision === 'bump') {
      try {
        const bumpResult = await handleVersionBump(versionInfo);
        console.log(
          chalk.green(
            t('build.version.bump.applied', {
              version: bumpResult.version,
              build: bumpResult.build,
            })
          )
        );
      } catch (error) {
        console.log(chalk.red(t('build.version.error.updateFailed', { message: error.message })));
        process.exitCode = 1;
        return;
      }
    } else {
      console.log(
        chalk.cyan(
          t('build.version.selection.keep', {
            version: versionDecision.versionDisplay,
            build: versionDecision.buildDisplay,
          })
        )
      );
    }

    const shouldRunAndroid = platform === 'android' || platform === 'both';
    const shouldRunIos = platform === 'ios' || platform === 'both';

    if (shouldRunAndroid) {
      try {
        await runAndroidBuild({ format: androidFormat || 'apk', config });
      } catch (error) {
        console.log(chalk.red(error.message));
        process.exitCode = 1;
        return;
      }
    }

    if (shouldRunIos) {
      try {
        await runIosBuild({ config });
      } catch (error) {
        console.log(chalk.red(error.message));
        process.exitCode = 1;
        return;
      }
    }
  });

  return program;
}

module.exports = registerBuildCommand;
