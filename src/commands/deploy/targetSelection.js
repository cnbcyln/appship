const chalk = require('chalk');
const { select, confirm } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { getPlatformLabelKey } = require('./platformSelection');

async function promptTargetSelection({ platform }) {
  const choices = platform === 'ios' ? iosTargets() : androidTargets();

  while (true) {
    const selection = await select({
      message: t('deploy.target.menu.prompt', { platform: t(getPlatformLabelKey(platform)) }),
      choices,
    });

    const isProduction = selection.key === 'production' || selection.key === 'appstore';
    if (isProduction) {
      const confirmed = await confirmProductionWarning({ platform });
      if (!confirmed) {
        console.log(chalk.yellow(t('deploy.target.cancelled')));
        continue;
      }
    }

    return selection;
  }
}

function androidTargets() {
  return [
    { value: { key: 'internal', label: t('deploy.target.android.internal') }, name: t('deploy.target.android.internal') },
    { value: { key: 'alpha', label: t('deploy.target.android.alpha') }, name: t('deploy.target.android.alpha') },
    { value: { key: 'beta', label: t('deploy.target.android.beta') }, name: t('deploy.target.android.beta') },
    { value: { key: 'production', label: t('deploy.target.android.production') }, name: t('deploy.target.android.production') },
  ];
}

function iosTargets() {
  return [
    { value: { key: 'testflight', label: t('deploy.target.ios.testflight') }, name: t('deploy.target.ios.testflight') },
    { value: { key: 'appstore', label: t('deploy.target.ios.appstore') }, name: t('deploy.target.ios.appstore') },
  ];
}

async function confirmProductionWarning({ platform }) {
  const lines = platform === 'ios' ? iosWarningLines() : androidWarningLines();
  lines.forEach((line) => console.log(chalk.yellow(line)));

  const confirmMessage = lines[lines.length - 1];
  return confirm({
    message: confirmMessage,
    default: false,
  });
}

function androidWarningLines() {
  return [
    t('deploy.target.warning.android.title'),
    t('deploy.target.warning.android.body'),
    t('deploy.target.warning.android.question'),
  ];
}

function iosWarningLines() {
  return [
    t('deploy.target.warning.ios.title'),
    t('deploy.target.warning.ios.body'),
    t('deploy.target.warning.ios.question'),
  ];
}

module.exports = {
  promptTargetSelection,
};
