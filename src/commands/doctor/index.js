const chalk = require('chalk');
const { runFlutterDoctor } = require('./flutter');
const { runFastlaneDoctor } = require('./fastlane');
const { t } = require('../../i18n');

function doctorCommand(program) {
  const doctor = program
    .command('doctor')
    .description(t('doctor.info.description'))
    .argument('[subcommand]')
    .option('--flutter', t('doctor.info.options.flutter'))
    .option('--fastlane', t('doctor.info.options.fastlane'));

  doctor.action(async (subcommand, options) => {
    if (subcommand) {
      if (subcommand === 'help') {
        console.log(t('doctor.info.helpDescription'));
        doctor.outputHelp();
        return;
      }
      console.log(chalk.red(t('doctor.error.unknownArgument', { value: subcommand })));
      process.exitCode = 1;
      return;
    }

    try {
      console.log(chalk.cyan.bold(`${t('doctor.info.intro')}\n`));

      const targets = resolveTargets(options);
      let overallSuccess = true;

      for (const target of targets) {
        if (target === 'flutter') {
          overallSuccess = (await runFlutterDoctor()) && overallSuccess;
        } else if (target === 'fastlane') {
          overallSuccess = (await runFastlaneDoctor()) && overallSuccess;
        }
      }

      const finalMessage = overallSuccess ? t('doctor.success.complete') : t('doctor.warning.partial');
      const finalColor = overallSuccess ? chalk.green : chalk.yellow;
      console.log(finalColor.bold(`\n${finalMessage}`));
      if (!overallSuccess) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.log(chalk.red(`\n${t('doctor.error.unexpected', { message: error.message })}`));
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
