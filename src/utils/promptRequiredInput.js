const chalk = require('chalk');
const { input } = require('@inquirer/prompts');
const { t } = require('../i18n');

async function promptRequiredInput({ message, defaultValue = '', errorMessage }) {
  let currentDefault = defaultValue ?? '';
  const fallbackError = errorMessage || t('setup.error.fieldRequired', { field: message });

  while (true) {
    const answer = await input({
      message,
      default: currentDefault,
    });

    const trimmed = (answer ?? '').trim();
    if (trimmed) {
      return trimmed;
    }

    console.log(chalk.red(fallbackError));
    currentDefault = '';
  }
}

module.exports = {
  promptRequiredInput,
};
