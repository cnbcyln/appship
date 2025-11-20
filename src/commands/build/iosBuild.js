const fs = require('fs');
const chalk = require('chalk');
const { runCommand } = require('../../utils/process');
const { t } = require('../../i18n');

function validateIosConfig(config = {}) {
  const missingSettings = [];
  const fileIssues = [];

  const requiredFields = [
    { key: 'APPLE_API_KEY_PATH', labelKey: 'setup.summary.fields.appleApiKeyPath', mustExist: true },
    { key: 'APPLE_API_KEY_ID', labelKey: 'setup.summary.fields.appleApiKeyId' },
    { key: 'APPLE_API_ISSUER_ID', labelKey: 'setup.summary.fields.appleApiIssuerId' },
    { key: 'APPLE_TEAM_ID', labelKey: 'setup.summary.fields.appleTeamId' },
    { key: 'APPLE_BUNDLE_ID', labelKey: 'setup.summary.fields.appleBundleId' },
  ];

  requiredFields.forEach((field) => {
    const value = (config[field.key] || '').trim();
    if (!value) {
      missingSettings.push(t(field.labelKey));
      return;
    }

    if (field.mustExist && !fs.existsSync(value)) {
      fileIssues.push(t(field.labelKey));
    }
  });

  const outputDir = (config.BUILD_OUTPUT_DIR || '').trim();
  const outputDirMissing = !outputDir;

  return {
    missingSettings,
    fileIssues,
    outputDir,
    outputDirMissing,
  };
}

async function runIosBuild({ config = {} }) {
  const validation = validateIosConfig(config);

  if (validation.missingSettings.length > 0 || validation.fileIssues.length > 0) {
    const labels = [...validation.missingSettings, ...validation.fileIssues].join(', ');
    throw new Error(
      t('build.ios.error.missingSettings', {
        fields: labels,
        command: 'appship setup ios-settings',
      })
    );
  }

  if (validation.outputDirMissing) {
    throw new Error(t('build.common.error.outputDirMissing', { command: 'appship setup build-output-dir' }));
  }

  if (!fs.existsSync(validation.outputDir)) {
    fs.mkdirSync(validation.outputDir, { recursive: true });
  }

  console.log(chalk.blue(t('build.ios.info.start')));
  const result = runCommand('flutter', ['build', 'ios', '--release'], { inherit: true });

  if (!result.success) {
    throw new Error(t('build.ios.error.buildFailed'));
  }

  console.log(chalk.green(t('build.ios.info.success')));
  return true;
}

module.exports = {
  runIosBuild,
};
