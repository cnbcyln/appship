const chalk = require('chalk');
const { select } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { handlePromptExit } = require('../../utils/exitPrompt');
const { ensureConfigFile, readConfig } = require('../../utils/config');
const registerProjectInfoCommand = require('./projectInfo');
const registerAndroidSettingsCommand = require('./androidSettings');
const registerIosSettingsCommand = require('./iosSettings');
const registerReleaseNotesCommand = require('./releaseNotes');
const registerBuildOutputDirCommand = require('./buildOutputDir');

function setupCommand(program) {
  const setup = program.command('setup').description(t('setup.info.description'));

  setup.action(async () => {
    while (true) {
      try {
        if (!process.stdin.isTTY) {
          setup.outputHelp();
          return;
        }

        const choice = await select({
          message: t('setup.menu.prompt'),
          choices: [
            { name: t('setup.menu.full'), value: 'full' },
            { name: t('setup.menu.projectInfo'), value: 'project' },
            { name: t('setup.menu.androidSettings'), value: 'android' },
            { name: t('setup.menu.iosSettings'), value: 'ios' },
            { name: t('setup.menu.releaseNotes'), value: 'release' },
            { name: t('setup.menu.buildOutputDir'), value: 'buildOutput' },
            { name: t('setup.menu.summary'), value: 'summary' },
          ],
        });

        switch (choice) {
          case 'full':
            await runFullSetup();
            break;
          case 'project':
            await runFlow(registerProjectInfoCommand.run);
            break;
          case 'android':
            await runFlow(registerAndroidSettingsCommand.run);
            break;
          case 'ios':
            await runFlow(registerIosSettingsCommand.run);
            break;
          case 'release':
            await runFlow(registerReleaseNotesCommand.run);
            break;
          case 'buildOutput':
            await runFlow(registerBuildOutputDirCommand.run);
            break;
          case 'summary':
            await showCurrentSummary();
            break;
          default:
            break;
        }
        break;
      } catch (error) {
        const handled = await handlePromptExit(error);
        if (handled === 'resume') {
          continue;
        }
        if (!handled) {
          throw error;
        }
        break;
      }
    }
  });

  registerProjectInfoCommand(setup);
  registerAndroidSettingsCommand(setup);
  registerIosSettingsCommand(setup);
  registerReleaseNotesCommand(setup);
  registerBuildOutputDirCommand(setup);

  setup
    .command('full')
    .description(t('setup.info.full.description'))
    .action(async () => {
      await runFullSetup();
    });

  return program;
}

async function runFullSetup() {
  await runFlowsSequentially();
  await showCurrentSummary();
  console.log(chalk.green(t('setup.success.fullCompleted')));
}

async function runFlowsSequentially() {
  const flows = [
    registerProjectInfoCommand.run,
    registerAndroidSettingsCommand.run,
    registerIosSettingsCommand.run,
    registerReleaseNotesCommand.run,
    registerBuildOutputDirCommand.run,
  ];

  const rows = [];
  for (const runFn of flows) {
    const result = await runFlow(runFn);
    if (result) {
      rows.push({
        label: result.label || '',
        value: result.value || '',
      });
    }
  }
  return rows;
}

async function runFlow(runFn) {
  if (typeof runFn !== 'function') {
    return null;
  }

  const result = await runFn({});
  if (result?.successMessage) {
    console.log(chalk.green(result.successMessage));
  }
  return result;
}

async function showCurrentSummary() {
  ensureConfigFile();
  const config = readConfig();
  const rows = buildSummaryRowsFromConfig(config);
  printSummary(rows);
}

function buildSummaryRowsFromConfig(config) {
  const fallback = t('setup.summary.notSet');
  const valueOrFallback = (value) => (value && value.trim ? value.trim() : value) || fallback;

  return [
    { label: t('setup.summary.fields.projectName'), value: valueOrFallback(config.PROJECT_NAME) },
    { label: t('setup.summary.fields.googlePlayServiceAccountKeyPath'), value: valueOrFallback(config.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH) },
    { label: t('setup.summary.fields.googlePlayPackageName'), value: valueOrFallback(config.GOOGLE_PLAY_PACKAGE_NAME) },
    { label: t('setup.summary.fields.appleApiKeyPath'), value: valueOrFallback(config.APPLE_API_KEY_PATH) },
    { label: t('setup.summary.fields.appleApiKeyId'), value: valueOrFallback(config.APPLE_API_KEY_ID) },
    { label: t('setup.summary.fields.appleApiIssuerId'), value: valueOrFallback(config.APPLE_API_ISSUER_ID) },
    { label: t('setup.summary.fields.appleTeamId'), value: valueOrFallback(config.APPLE_TEAM_ID) },
    { label: t('setup.summary.fields.appleBundleId'), value: valueOrFallback(config.APPLE_BUNDLE_ID) },
    { label: t('setup.summary.fields.releaseNotesTr'), value: valueOrFallback(config.RELEASE_NOTES_TR) },
    { label: t('setup.summary.fields.releaseNotesEn'), value: valueOrFallback(config.RELEASE_NOTES_EN) },
    { label: t('setup.summary.fields.buildOutputDir'), value: valueOrFallback(config.BUILD_OUTPUT_DIR) },
  ];
}

function printSummary(rows) {
  console.log(chalk.blue.bold(`\n${t('setup.summary.title')}`));
  rows.forEach((row) => {
    const value = row.value && row.value.length > 0 ? row.value : t('setup.summary.notSet');
    const lines = String(value).split('\n');
    const firstLine = lines.shift();
    console.log(`${chalk.cyan('- ' + row.label + ':')} ${chalk.yellow(firstLine)}`);
    lines.forEach((line) => {
      console.log(chalk.yellow(`  ${line}`));
    });
  });
}

module.exports = setupCommand;
