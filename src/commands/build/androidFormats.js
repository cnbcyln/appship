const { selectWithBack } = require('../../utils/selectWithBack');
const { t } = require('../../i18n');

async function promptAndroidFormatSelection() {
  const format = await selectWithBack({
    message: t('build.format.menu.prompt'),
    choices: [
      { value: 'apk', name: t('build.format.menu.apk') },
      { value: 'aab', name: t('build.format.menu.aab') },
    ],
  });

  return format === null ? null : format;
}

function getFormatLabelKey(format) {
  switch (format) {
    case 'apk':
      return 'build.format.menu.apk';
    case 'aab':
    default:
      return 'build.format.menu.aab';
  }
}

module.exports = {
  promptAndroidFormatSelection,
  getFormatLabelKey,
};
