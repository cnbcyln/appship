const chalk = require('chalk');
const { t } = require('../../i18n');
const { ensureConfigFile, readConfig } = require('../../utils/config');
const { promptPlatformSelection, getPlatformLabelKey } = require('./platformSelection');
const { promptArtifactSelection } = require('./outputSelection');
const { promptTargetSelection } = require('./targetSelection');
const { runAndroidDeploy } = require('./androidDeploy');
const { runIosDeploy } = require('./iosDeploy');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');

function registerDeployCommand(program) {
  const deploy = program.command('deploy').description(t('deploy.description'));

  deploy.action(async () => {
    if (!process.stdin.isTTY) {
      console.log(chalk.red(t('deploy.error.nonInteractive')));
      deploy.outputHelp();
      process.exitCode = 1;
      return;
    }

    const platform = await promptPlatformSelection();
    console.log(chalk.cyan(t('deploy.platform.selection', { value: t(getPlatformLabelKey(platform)) })));

    ensureConfigFile();
    let config = readConfig();

    const baseOutputDir = (config.BUILD_OUTPUT_DIR || '').trim();
    if (!baseOutputDir) {
      console.log(chalk.red(t('setupFix.failed')));
      process.exitCode = 1;
      return;
    }

    const selections = {};
    if (platform === 'both') {
      const androidResult = await handlePlatformSelection({ platform: 'android', baseOutputDir });
      if (!androidResult) return;
      selections.android = androidResult;

      const iosResult = await handlePlatformSelection({ platform: 'ios', baseOutputDir });
      if (!iosResult) return;
      selections.ios = iosResult;
    } else {
      const result = await handlePlatformSelection({ platform, baseOutputDir });
      if (!result) return;
      selections[platform] = result;
    }

    if (platform === 'both') {
      const okAndroid = await deployPlatform({ platform: 'android', selections, config });
      if (!okAndroid) return;
      const okIos = await deployPlatform({ platform: 'ios', selections, config });
      if (!okIos) return;
    } else if (platform === 'android') {
      const ok = await deployPlatform({ platform: 'android', selections, config });
      if (!ok) return;
    } else if (platform === 'ios') {
      const ok = await deployPlatform({ platform: 'ios', selections, config });
      if (!ok) return;
    }
  });

  return program;
}

module.exports = registerDeployCommand;

async function handlePlatformSelection({ platform, baseOutputDir }) {
  const artifact = await promptArtifactSelection({ platform, baseOutputDir });
  if (!artifact) {
    process.exitCode = 1;
    return null;
  }

  console.log(chalk.green(t('deploy.output.selected', { platform: t(getPlatformLabelKey(platform)), file: artifact.name })));

  const target = await promptTargetSelection({ platform });
  if (!target) {
    process.exitCode = 1;
    return null;
  }

  console.log(chalk.green(t('deploy.target.selected', { platform: t(getPlatformLabelKey(platform)), target: target.label })));
  return { artifact, target };
}

async function deployPlatform({ platform, selections, config }) {
  const selection = selections[platform];
  if (!selection) {
    return false;
  }

  try {
    if (platform === 'android') {
      await runAndroidDeploy({
        artifact: selection.artifact,
        target: selection.target,
        config,
      });
    } else if (platform === 'ios') {
      await runIosDeploy({
        artifact: selection.artifact,
        target: selection.target,
        config,
      });
    }
    return true;
  } catch (error) {
    console.log(chalk.red(error.message));
    process.exitCode = 1;
    return false;
  }
}
