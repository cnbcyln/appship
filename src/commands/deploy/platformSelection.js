const { selectWithBack } = require('../../utils/selectWithBack');
const { t } = require('../../i18n');

async function promptPlatformSelection() {
  const choice = await selectWithBack({
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
