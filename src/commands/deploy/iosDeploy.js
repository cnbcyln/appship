const fs = require('fs');
const os = require('os');
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

  if (config.APPLE_API_KEY_PATH && fs.existsSync(config.APPLE_API_KEY_PATH)) {
    const ext = path.extname(config.APPLE_API_KEY_PATH).toLowerCase();
    const supported = ['.p8', '.json'];
    if (!supported.includes(ext)) {
      missing.push(t('deploy.run.ios.errors.invalidApiKeyFormat'));
    }
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

  const apiKeyPath = prepareApiKeyFile(config);
  const appId = config.APPLE_BUNDLE_ID;
  const env = {
    ...process.env,
    APP_STORE_CONNECT_API_KEY_PATH: apiKeyPath,
    DELIVER_ITMSTRANSPORTER_ADDITIONAL_UPLOAD_PARAMETERS: '-t DAV',
  };

  console.log(chalk.blue(t('deploy.run.ios.start')));

  if (isAppStore(target.key)) {
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
    const mapped = mapIosFailure(result, 'appstore');
    throw new Error(mapped);
  }

    console.log(chalk.green(t('deploy.run.ios.success.appstore')));
    return { platform: 'ios', target: 'appstore', artifact: artifact.path };
  }

  const changelog = buildChangelog(config);
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
  if (changelog) {
    args.push('--changelog', changelog);
  }
  if (config.APPLE_TEAM_ID) {
    args.push('--itc_provider', config.APPLE_TEAM_ID);
  }

  const result = runCommand('fastlane', args, { inherit: true, env });
  if (!result.success) {
    const mapped = mapIosFailure(result, 'testflight');
    throw new Error(mapped);
  }

  console.log(chalk.green(t('deploy.run.ios.success.testflight')));
  return { platform: 'ios', target: 'testflight', artifact: artifact.path };
}

module.exports = {
  runIosDeploy,
};

function mapIosFailure(result, target) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const normalized = output.toLowerCase();

  if (normalized.includes('json::parsererror') || output.includes('-----BEGIN')) {
    return t('deploy.run.ios.errors.invalidApiKeyFormat');
  }

  if (target === 'appstore') {
    return t('deploy.run.ios.errors.uploadFailedAppstore');
  }
  return t('deploy.run.ios.errors.uploadFailedTestflight');
}

function prepareApiKeyFile(config) {
  const rawPath = path.resolve(config.APPLE_API_KEY_PATH);
  const ext = path.extname(rawPath).toLowerCase();

  if (ext === '.json') {
    return rawPath;
  }

  if (ext !== '.p8') {
    throw new Error(t('deploy.run.ios.errors.invalidApiKeyFormat'));
  }

  const keyId = (config.APPLE_API_KEY_ID || '').trim();
  const issuerId = (config.APPLE_API_ISSUER_ID || '').trim();
  if (!keyId || !issuerId) {
    throw new Error(t('deploy.run.ios.errors.invalidApiKeyFormat'));
  }

  let keyContent;
  try {
    keyContent = fs.readFileSync(rawPath, 'utf8');
  } catch {
    throw new Error(t('deploy.run.ios.errors.invalidApiKeyFormat'));
  }

  const normalizedKey = keyContent.replace(/\r\n/g, '\n');
  const jsonPayload = {
    key_id: keyId,
    issuer_id: issuerId,
    key: normalizedKey,
  };

  const safeKeyId = keyId.replace(/[^a-z0-9_\-]/gi, ''); // avoids odd filenames
  const targetPath = path.join(os.tmpdir(), `appship_asc_${safeKeyId || 'key'}.json`);
  fs.writeFileSync(targetPath, JSON.stringify(jsonPayload, null, 2), 'utf8');
  return targetPath;
}

function buildChangelog(config = {}) {
  const en = (config.RELEASE_NOTES_EN || '').trim();
  const tr = (config.RELEASE_NOTES_TR || '').trim();

  if (en) return en;
  if (tr) return tr;
  return '';
}
