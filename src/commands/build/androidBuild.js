const fs = require('fs');
const chalk = require('chalk');
const { runCommand } = require('../../utils/process');
const { t } = require('../../i18n');

function validateAndroidConfig(config = {}) {
  const missingSettings = [];
  const fileIssues = [];

  const requiredFields = [
    { key: 'GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH', labelKey: 'setup.summary.fields.googlePlayServiceAccountKeyPath', mustExist: true },
    { key: 'GOOGLE_PLAY_PACKAGE_NAME', labelKey: 'setup.summary.fields.googlePlayPackageName' },
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

async function runAndroidBuild({ format = 'apk', config = {} }) {
  const validation = validateAndroidConfig(config);

  if (validation.missingSettings.length > 0 || validation.fileIssues.length > 0) {
    const labels = [...validation.missingSettings, ...validation.fileIssues].join(', ');
    throw new Error(
      t('build.android.error.missingSettings', {
        fields: labels,
        command: 'appship setup android-settings',
      })
    );
  }

  if (validation.outputDirMissing) {
    throw new Error(t('build.common.error.outputDirMissing', { command: 'appship setup build-output-dir' }));
  }

  if (!fs.existsSync(validation.outputDir)) {
    fs.mkdirSync(validation.outputDir, { recursive: true });
  }

  const formatLabelKey = format === 'aab' ? 'build.format.menu.aab' : 'build.format.menu.apk';
  console.log(chalk.blue(t('build.android.info.start', { value: t(formatLabelKey) })));

  const args = format === 'aab' ? ['build', 'appbundle', '--release'] : ['build', 'apk', '--release'];
  const result = runCommand('flutter', args, { inherit: true });

  if (!result.success) {
    throw new Error(t('build.android.error.buildFailed'));
  }

  console.log(chalk.green(t('build.android.info.success')));
  return {
    format,
  };
}

module.exports = {
  runAndroidBuild,
};
