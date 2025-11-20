const { select } = require('@inquirer/prompts');
const { t } = require('../../i18n');

async function promptPlatformSelection() {
  const choice = await select({
    message: t('build.platform.menu.prompt'),
    choices: [
      { value: 'android', name: t('build.platform.menu.android') },
      { value: 'ios', name: t('build.platform.menu.ios') },
      { value: 'both', name: t('build.platform.menu.both') },
    ],
  });

  return choice;
}

function getPlatformLabelKey(platform) {
  switch (platform) {
    case 'android':
      return 'build.platform.menu.android';
    case 'ios':
      return 'build.platform.menu.ios';
    case 'both':
    default:
      return 'build.platform.menu.both';
  }
}

module.exports = {
  promptPlatformSelection,
  getPlatformLabelKey,
};
