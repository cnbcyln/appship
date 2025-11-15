const chalk = require('chalk');
const { input } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { ensureConfigFile, readConfig, updateConfig, getConfigPath } = require('../../utils/config');

async function handleReleaseNotes(options = {}) {
  ensureConfigFile();
  const currentConfig = readConfig();

  const releaseNotesTr =
    options.releaseNotesTr ||
    (await input({
      message: t('setup.info.releaseNotes.prompts.releaseNotesTr'),
      default: currentConfig.RELEASE_NOTES_TR || '',
    }));

  const releaseNotesEn =
    options.releaseNotesEn ||
    (await input({
      message: t('setup.info.releaseNotes.prompts.releaseNotesEn'),
      default: currentConfig.RELEASE_NOTES_EN || '',
    }));

  const normalizedTr = (releaseNotesTr || '').trim();
  const normalizedEn = (releaseNotesEn || '').trim();

  if (!normalizedTr || !normalizedEn) {
    console.log(chalk.red(t('setup.error.releaseNotesMissingFields')));
    process.exitCode = 1;
    return;
  }

  updateConfig({
    RELEASE_NOTES_TR: normalizedTr,
    RELEASE_NOTES_EN: normalizedEn,
  });

  return {
    label: t('setup.info.releaseNotes.summaryLabel'),
    value: formatReleaseNotePreview(normalizedTr, normalizedEn),
    successMessage: t('setup.success.releaseNotesUpdated', { path: getConfigPath() }),
  };
}

function registerReleaseNotesCommand(setup) {
  setup
    .command('release-notes')
    .alias('rn')
    .description(t('setup.info.releaseNotes.description'))
    .option('--release-notes-tr <text>', t('setup.info.releaseNotes.options.releaseNotesTr'))
    .option('--release-notes-en <text>', t('setup.info.releaseNotes.options.releaseNotesEn'))
    .action(async (options) => {
      const result = await handleReleaseNotes(options);
      if (result?.successMessage) {
        console.log(chalk.green(result.successMessage));
      }
    });
}

module.exports = registerReleaseNotesCommand;
module.exports.run = handleReleaseNotes;

function formatReleaseNotePreview(trNotes, enNotes) {
  const fallback = t('setup.summary.notSet');
  const format = (text) => {
    const safeValue = (text || '').trim() || fallback;
    return safeValue.length > 40 ? `${safeValue.slice(0, 40)}…` : safeValue;
  };

  return `TR: ${format(trNotes)} | EN: ${format(enNotes)}`;
}
