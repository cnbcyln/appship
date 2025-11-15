const colors = require('colors/safe');
const { runFlutterDoctor } = require('./flutter');
const { runFastlaneDoctor } = require('./fastlane');
const { t } = require('../../i18n');

function doctorCommand(program) {
  const doctor = program
    .command('doctor')
    .description(t('doctor.description'))
    .option('--flutter', t('doctor.options.flutter'))
    .option('--fastlane', t('doctor.options.fastlane'));

  doctor
    .command('help')
    .description(t('doctor.helpDescription'))
    .action(() => {
      doctor.outputHelp();
    });

  doctor.action(async (options) => {
    try {
      console.log(colors.cyan.bold(`${t('doctor.intro')}\n`));

      const targets = resolveTargets(options);
      let overallSuccess = true;

      for (const target of targets) {
        if (target === 'flutter') {
          overallSuccess = (await runFlutterDoctor()) && overallSuccess;
        } else if (target === 'fastlane') {
          overallSuccess = (await runFastlaneDoctor()) && overallSuccess;
        }
      }

      const finalMessage = overallSuccess ? t('doctor.complete') : t('doctor.partial');
      const finalColor = overallSuccess ? colors.green : colors.yellow;
      console.log(finalColor.bold(`\n${finalMessage}`));
      if (!overallSuccess) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(colors.red(`\n${t('doctor.unexpectedError', { message: error.message })}`));
      process.exitCode = 1;
    }
  });

  return program;
}

function resolveTargets(options) {
  const targets = [];
  if (options.flutter) {
    targets.push('flutter');
  }
  if (options.fastlane) {
    targets.push('fastlane');
  }
  if (targets.length === 0) {
    return ['flutter', 'fastlane'];
  }
  return targets;
}

module.exports = doctorCommand;
