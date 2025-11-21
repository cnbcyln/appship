const fs = require('fs');
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const { runCommand } = require('../../utils/process');
const { t } = require('../../i18n');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');

function validateAndroidDeployConfig({ config, artifact }) {
  const missing = [];
  if (!artifact || !artifact.path || !fs.existsSync(artifact.path)) {
    missing.push(t('deploy.run.android.errors.artifactMissing'));
  }

  if (!config.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH || !fs.existsSync(config.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH)) {
    missing.push(t('deploy.run.android.errors.missingServiceAccountKey'));
  }
  if (!config.GOOGLE_PLAY_PACKAGE_NAME) {
    missing.push(t('deploy.run.android.errors.missingPackageName'));
  }

  const ext = path.extname(artifact?.path || '').toLowerCase();
  const supported = ['.aab', '.apk'];
  if (!supported.includes(ext)) {
    missing.push(t('deploy.run.android.errors.unsupportedExtension', { ext: ext || t('common.unknownValue') }));
  }

  return missing;
}

function resolveTrack(targetKey) {
  switch (targetKey) {
    case 'internal':
      return 'internal';
    case 'alpha':
      return 'alpha';
    case 'beta':
      return 'beta';
    case 'production':
    default:
      return 'production';
  }
}

async function runAndroidDeploy({ artifact, target, config, releaseNotes }) {
  const ensured = await ensureSetupPrerequisites({ platform: 'android' });
  if (!ensured) {
    throw new Error(t('setupFix.cancelled'));
  }
  config = ensured;

  const issues = validateAndroidDeployConfig({ config, artifact });
  if (issues.length > 0) {
    throw new Error(t('setupFix.failed'));
  }

  const ext = path.extname(artifact.path).toLowerCase();
  const track = resolveTrack(target.key);
  const args = [
    'supply',
    '--track',
    track,
    '--json_key',
    config.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH,
    '--package_name',
    config.GOOGLE_PLAY_PACKAGE_NAME,
    '--skip_upload_metadata',
    'true',
    '--skip_upload_images',
    'true',
    '--skip_upload_screenshots',
    'true',
    '--changes_not_sent_for_review',
    'true',
    '--verbose',
    'true',
  ];

  const metadataPath = createAndroidReleaseNotesMetadata(releaseNotes);
  if (metadataPath) {
    args.push('--metadata_path', metadataPath);
  }

  if (ext === '.aab') {
    args.push('--aab', artifact.path);
  } else {
    args.push('--apk', artifact.path);
  }

  console.log(chalk.blue(t('deploy.run.android.start', { track })));
  const result = runCommand('fastlane', args, { inherit: false });

  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }

  if (!result.success) {
    const mapped = mapAndroidFailure(result);
    const err = new Error(mapped.message);
    if (mapped.codeAlreadyUsed) {
      err.codeAlreadyUsed = true;
      err.versionCode = mapped.versionCode;
    }
    throw err;
  }

  console.log(chalk.green(t('deploy.run.android.success', { track })));
  return {
    platform: 'android',
    track,
    artifact: artifact.path,
  };
}

function mapAndroidFailure(result) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.toLowerCase();
  if (output.includes('version code') && output.includes('already been used')) {
    const match = output.match(/version code\s+(\d+)/i);
    const code = match && match[1] ? match[1] : t('common.unknownValue');
    return { message: t('deploy.run.android.errors.versionCodeUsed', { code }), codeAlreadyUsed: true, versionCode: code };
  }

  const fallback = result.stderr || result.stdout || t('common.unknownError');
  return { message: t('deploy.run.android.errors.uploadFailedGeneric', { message: fallback }), codeAlreadyUsed: false };
}

module.exports = {
  runAndroidDeploy,
};

function createAndroidReleaseNotesMetadata(releaseNotes) {
  if (!releaseNotes) {
    return null;
  }

  const entries = [];
  const en = (releaseNotes.en || '').trim();
  const tr = (releaseNotes.tr || '').trim();
  if (en) entries.push({ code: 'en-US', value: en });
  if (tr) entries.push({ code: 'tr-TR', value: tr });

  if (!entries.length) {
    return null;
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appship_play_notes_'));
  const metaRoot = path.join(tmpRoot, 'metadata', 'android');

  entries.forEach((entry) => {
    const changelogDir = path.join(metaRoot, entry.code, 'changelogs');
    fs.mkdirSync(changelogDir, { recursive: true });
    const targetFile = path.join(changelogDir, 'default.txt');
    fs.writeFileSync(targetFile, entry.value, 'utf8');
  });

  return path.join(tmpRoot, 'metadata');
}
