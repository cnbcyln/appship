const { confirm } = require('@inquirer/prompts');
const { t } = require('../i18n');

let registered = false;
let handlingSigint = false;

function registerExitPrompt() {
  if (registered) {
    return;
  }
  registered = true;

  process.on('SIGINT', async () => {
    if (handlingSigint) {
      return;
    }
    handlingSigint = true;
    try {
      const shouldExit = await confirm({
        message: t('common.exitPrompt'),
        default: false,
      });
      if (shouldExit) {
        process.exit(1);
      }
    } catch {
      // ignore prompt errors during SIGINT
    } finally {
      handlingSigint = false;
    }
  });
}

async function handlePromptExit(error) {
  if (!error || error.name !== 'ExitPromptError') {
    return false;
  }

  try {
    const shouldExit = await confirm({
      message: t('common.exitPrompt'),
      default: false,
    });
    if (shouldExit) {
      process.exit(1);
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  registerExitPrompt,
  handlePromptExit,
};
