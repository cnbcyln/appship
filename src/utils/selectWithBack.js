const { select } = require('@inquirer/prompts');
const { t } = require('../i18n');

const BACK_VALUE = '__back';

async function selectWithBack(options = {}) {
  const allowBack =
    Object.prototype.hasOwnProperty.call(options, 'allowBack') && options.allowBack !== undefined
      ? options.allowBack
      : global.__APPSHIP_ALLOW_BACK === true;

  if (!allowBack) {
    return select(options);
  }

  const backLabel = t('common.back', '⬅️  Back');
  const baseChoices = options.choices || [];
  const choices = [...baseChoices, { value: BACK_VALUE, name: backLabel }];
  const answer = await select({ ...options, choices });
  if (answer === BACK_VALUE) {
    return null;
  }
  return answer;
}

module.exports = {
  selectWithBack,
};
