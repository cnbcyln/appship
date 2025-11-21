const { select } = require('@inquirer/prompts');
const { t } = require('../i18n');
const baseTheme = require('./selectTheme');

const BACK_VALUE = '__back';

function shouldAllowBack(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'allowBack')) {
    return Boolean(options.allowBack);
  }
  return true;
}

async function selectWithBack(options = {}) {
  const allowBack = shouldAllowBack(options);
  if (!allowBack) {
    return select(options);
  }

  const backLabel = options.backLabel || t('common.back', '⬅️  Back');
  const baseChoices = options.choices || [];
  const choices = [...baseChoices, { value: BACK_VALUE, name: backLabel }];
  const answer = await select({ ...options, choices, pageSize: 10, theme: baseTheme });
  if (answer === BACK_VALUE) {
    return null;
  }
  return answer;
}

module.exports = {
  selectWithBack,
  shouldAllowBack,
  BACK_VALUE,
};
