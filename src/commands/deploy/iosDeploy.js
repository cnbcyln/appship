const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { runCommand } = require('../../utils/process');
const { t } = require('../../i18n');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');

function validateIosDeployConfig({ config, artifact }) {
  const missing = [];

  if (!artifact || !artifact.path || !fs.existsSync(artifact.path)) {
    missing.push(t('deploy.run.ios.errors.artifactMissing'));
  }

  if (!config.APPLE_API_KEY_PATH || !fs.existsSync(config.APPLE_API_KEY_PATH)) {
    missing.push(t('deploy.run.ios.errors.missingApiKeyPath'));
  }
  if (!config.APPLE_API_KEY_ID) {
    missing.push(t('deploy.run.ios.errors.missingApiKeyId'));
  }
  if (!config.APPLE_API_ISSUER_ID) {
    missing.push(t('deploy.run.ios.errors.missingApiIssuerId'));
  }
  if (!config.APPLE_BUNDLE_ID) {
    missing.push(t('deploy.run.ios.errors.missingBundleId'));
  }

  const ext = path.extname(artifact?.path || '').toLowerCase();
  const supported = ['.ipa'];
  if (!supported.includes(ext)) {
    missing.push(t('deploy.run.ios.errors.unsupportedExtension', { ext: ext || t('common.unknownValue') }));
  }

  return missing;
}

function isAppStore(targetKey) {
  return targetKey === 'appstore';
}

async function runIosDeploy({ artifact, target, config }) {
  const ensured = await ensureSetupPrerequisites({ platform: 'ios' });
  if (!ensured) {
    throw new Error(t('setupFix.cancelled'));
  }
  config = ensured;

  const issues = validateIosDeployConfig({ config, artifact });
  if (issues.length > 0) {
    throw new Error(t('setupFix.failed'));
  }

  const apiKeyPath = path.resolve(config.APPLE_API_KEY_PATH);
  const appId = config.APPLE_BUNDLE_ID;
  const env = {
    ...process.env,
    APP_STORE_CONNECT_API_KEY_PATH: apiKeyPath,
    DELIVER_ITMSTRANSPORTER_ADDITIONAL_UPLOAD_PARAMETERS: '-t DAV',
  };

  if (isAppStore(target.key)) {
    console.log(chalk.blue(t('deploy.run.ios.start.appstore')));
    const args = [
      'deliver',
      '--ipa',
      artifact.path,
      '--api_key_path',
      apiKeyPath,
      '--app_identifier',
      appId,
      '--skip_metadata',
      'true',
      '--skip_screenshots',
      'true',
      '--skip_app_version_update',
      'true',
      '--force',
      'true',
    ];

    const result = runCommand('fastlane', args, { inherit: true, env });
    if (!result.success) {
      throw new Error(t('deploy.run.ios.errors.uploadFailedAppstore'));
    }

    console.log(chalk.green(t('deploy.run.ios.success.appstore')));
    return { platform: 'ios', target: 'appstore', artifact: artifact.path };
  }

  console.log(chalk.blue(t('deploy.run.ios.start.testflight')));
  const args = [
    'pilot',
    'upload',
    '--ipa',
    artifact.path,
    '--api_key_path',
    apiKeyPath,
    '--app_identifier',
    appId,
    '--distribute_external',
    'true',
    '--skip_waiting_for_build_processing',
    'true',
  ];
  if (config.APPLE_TEAM_ID) {
    args.push('--itc_provider', config.APPLE_TEAM_ID);
  }

  const result = runCommand('fastlane', args, { inherit: true, env });
  if (!result.success) {
    throw new Error(t('deploy.run.ios.errors.uploadFailedTestflight'));
  }

  console.log(chalk.green(t('deploy.run.ios.success.testflight')));
  return { platform: 'ios', target: 'testflight', artifact: artifact.path };
}

module.exports = {
  runIosDeploy,
};
