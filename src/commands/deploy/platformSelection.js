const { selectWithBack } = require('../../utils/navigation');
const { t } = require('../../i18n');

async function promptPlatformSelection() {
  const allowBack = global.__APPSHIP_FROM_MAIN === true ? true : false;
  const choice = await selectWithBack({
    allowBack,
    message: t('deploy.platform.menu.prompt'),
    choices: [
      { value: 'android', name: t('deploy.platform.menu.android') },
      { value: 'ios', name: t('deploy.platform.menu.ios') },
      { value: 'both', name: t('deploy.platform.menu.both') },
    ],
  });

  return choice === null ? null : choice;
}

function getPlatformLabelKey(platform) {
  switch (platform) {
    case 'android':
      return 'deploy.platform.menu.android';
    case 'ios':
      return 'deploy.platform.menu.ios';
    case 'both':
    default:
      return 'deploy.platform.menu.both';
  }
}

module.exports = {
  promptPlatformSelection,
  getPlatformLabelKey,
};
