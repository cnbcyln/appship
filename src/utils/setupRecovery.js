const fs = require('fs');
const { confirm } = require('@inquirer/prompts');
const { readConfig, updateConfig } = require('./config');
const { t } = require('../i18n');
const registerProjectInfoCommand = require('../commands/setup/projectInfo');
const registerAndroidSettingsCommand = require('../commands/setup/androidSettings');
const registerIosSettingsCommand = require('../commands/setup/iosSettings');
const registerReleaseNotesCommand = require('../commands/setup/releaseNotes');
const registerBuildOutputDirCommand = require('../commands/setup/buildOutputDir');

async function ensureSetupPrerequisites({ platform }) {
  if (!process.stdin.isTTY) {
    return readConfig();
  }

  let config = readConfig();
  let updated = false;

  if (isProjectInfoMissing(config)) {
    const proceed = await confirm({ message: t('setupFix.prompts.projectInfo'), default: true });
    if (!proceed) return null;
    await registerProjectInfoCommand.run({});
    config = readConfig();
    updated = true;
  }

  if (isReleaseNotesMissing(config)) {
    const proceed = await confirm({ message: t('setupFix.prompts.releaseNotes'), default: true });
    if (!proceed) return null;
    await registerReleaseNotesCommand.run({});
    config = readConfig();
    updated = true;
  }

  if (isOutputDirMissing(config)) {
    const proceed = await confirm({ message: t('setupFix.prompts.buildOutputDir'), default: true });
    if (!proceed) return null;
    await registerBuildOutputDirCommand.run({});
    config = readConfig();
    updated = true;
  }

  if (platform === 'android' || platform === 'both') {
    if (isAndroidSettingsMissing(config)) {
      const proceed = await confirm({ message: t('setupFix.prompts.androidSettings'), default: true });
      if (!proceed) return null;
      await registerAndroidSettingsCommand.run({});
      config = readConfig();
      updated = true;
    }
  }

  if (platform === 'ios' || platform === 'both') {
    if (isIosSettingsMissing(config)) {
      const proceed = await confirm({ message: t('setupFix.prompts.iosSettings'), default: true });
      if (!proceed) return null;
      await registerIosSettingsCommand.run({});
      config = readConfig();
      updated = true;
    }
  }

  if (updated) {
    config = readConfig();
  }

  return config;
}

function isProjectInfoMissing(config) {
  return !config.PROJECT_NAME;
}

function isReleaseNotesMissing(config) {
  return !config.RELEASE_NOTES_TR || !config.RELEASE_NOTES_EN;
}

function isOutputDirMissing(config) {
  return !config.BUILD_OUTPUT_DIR;
}

function isAndroidSettingsMissing(config) {
  if (!config.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH || !config.GOOGLE_PLAY_PACKAGE_NAME) {
    return true;
  }
  return !fs.existsSync(config.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH);
}

function isIosSettingsMissing(config) {
  const required = [
    'APPLE_API_KEY_PATH',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER_ID',
    'APPLE_TEAM_ID',
    'APPLE_BUNDLE_ID',
  ];

  const missingField = required.some((key) => !config[key]);
  const missingFile = !config.APPLE_API_KEY_PATH || !fs.existsSync(config.APPLE_API_KEY_PATH);
  return missingField || missingFile;
}

module.exports = {
  ensureSetupPrerequisites,
};
