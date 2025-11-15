const { t } = require('../../i18n');
const registerProjectInfoCommand = require('./projectInfo');

function setupCommand(program) {
  const setup = program.command('setup').description(t('setup.description'));

  registerProjectInfoCommand(setup);

  return program;
}

module.exports = setupCommand;
