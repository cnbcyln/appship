const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
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

async function runIosDeploy({ artifact, target, config, releaseNotes }) {
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
  const availableLocales = await fetchAppStoreLocales({ config, apiKeyPath });
  const appId = config.APPLE_BUNDLE_ID;
  const env = {
    ...process.env,
    APP_STORE_CONNECT_API_KEY_PATH: apiKeyPath,
    DELIVER_ITMSTRANSPORTER_ADDITIONAL_UPLOAD_PARAMETERS: '-t DAV',
  };

  console.log(chalk.blue(t('deploy.run.ios.start')));

  if (isAppStore(target.key)) {
    const notesMap = buildReleaseNotesMap(config, releaseNotes, availableLocales);
    const args = [
      'deliver',
      '--ipa',
      artifact.path,
      '--api_key_path',
      apiKeyPath,
      '--app_identifier',
      appId,
      '--skip_screenshots',
      'true',
      '--force',
      'true',
      '--submit_for_review',
      'true',
      '--automatic_release',
      'false',
      '--run_precheck_before_submit',
      'false',
      '--submission_information',
      JSON.stringify({
        export_compliance_uses_encryption: false,
        export_compliance_encryption_updated: false,
        export_compliance_app_type: 'standard',
      }),
    ];
    if (notesMap) {
      args.push('--release_notes', JSON.stringify(notesMap));
    }

  const result = runCommand('fastlane', args, { inherit: true, env });
  if (!result.success) {
    const mapped = mapIosFailure(result, 'appstore');
    throw new Error(mapped);
  }

    console.log(chalk.green(t('deploy.run.ios.success.appstore')));
    return { platform: 'ios', target: 'appstore', artifact: artifact.path };
  }

  const changelog = buildChangelog(config, releaseNotes);
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
    'false',
    '--notify_external_testers',
    'false',
    '--wait_processing_timeout_duration',
    '3600',
    '--wait_for_uploaded_build',
    'true',
    '--skip_submission',
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

function buildChangelog(config = {}, overrideReleaseNotes) {
  const overrideEn = (overrideReleaseNotes?.en || '').trim();
  const overrideTr = (overrideReleaseNotes?.tr || '').trim();
  const en = (config.RELEASE_NOTES_EN || '').trim();
  const tr = (config.RELEASE_NOTES_TR || '').trim();

  if (overrideEn) return overrideEn;
  if (overrideTr) return overrideTr;
  if (en) return en;
  if (tr) return tr;
  return '';
}

async function fetchAppStoreLocales({ config, apiKeyPath }) {
  try {
    const token = buildAppStoreJwtFromKey(config, apiKeyPath);
    const appId = await fetchAppId({ bundleId: config.APPLE_BUNDLE_ID, token });
    if (!appId) {
      return ['en-US'];
    }
    const versionId = await fetchLatestVersionId({ appId, token });
    if (!versionId) {
      return ['en-US'];
    }
    const locales = await fetchLocalesForVersion({ versionId, token });
    return locales.length ? locales : ['en-US'];
  } catch {
    return ['en-US'];
  }
}

function buildAppStoreJwtFromKey(config, apiKeyPath) {
  const resolved = apiKeyPath || prepareApiKeyFile(config);
  const content = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(content);
  const keyId = parsed.key_id || parsed.keyId || parsed.keyID;
  const issuerId = parsed.issuer_id || parsed.issuerId;
  const privateKey = parsed.key || parsed.private_key || parsed.privateKey;

  if (!keyId || !issuerId || !privateKey) {
    throw new Error('Invalid API key file');
  }

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    exp: now + 1200,
    aud: 'appstoreconnect-v1',
  };

  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('sha256');
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchAppId({ bundleId, token }) {
  const url = `https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`;
  const json = await fetchJson(url, token);
  return json?.data?.[0]?.id || null;
}

async function fetchLatestVersionId({ appId, token }) {
  const url = `https://api.appstoreconnect.apple.com/v1/apps/${appId}/appStoreVersions?limit=1&sort=-versionString&filter[platform]=IOS`;
  const json = await fetchJson(url, token);
  return json?.data?.[0]?.id || null;
}

async function fetchLocalesForVersion({ versionId, token }) {
  const url = `https://api.appstoreconnect.apple.com/v1/appStoreVersionLocalizations?filter[appStoreVersion]=${encodeURIComponent(
    versionId
  )}&fields[appStoreVersionLocalizations]=locale&limit=50`;
  const json = await fetchJson(url, token);
  const locales = (json?.data || []).map((item) => item?.attributes?.locale).filter(Boolean);
  return locales;
}

async function fetchJson(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

function buildReleaseNotesMap(config = {}, overrideReleaseNotes, availableLocales = []) {
  const locales = Array.isArray(availableLocales) && availableLocales.length > 0 ? availableLocales : ['en-US'];
  const overrideEn = (overrideReleaseNotes?.en || '').trim();
  const overrideTr = (overrideReleaseNotes?.tr || '').trim();
  const en = (config.RELEASE_NOTES_EN || '').trim();
  const tr = (config.RELEASE_NOTES_TR || '').trim();

  const map = {};
  const fallback = overrideEn || overrideTr || en || tr || '';
  if (!fallback) {
    return null;
  }

  locales.forEach((locale) => {
    if (!locale) return;
    const low = locale.toLowerCase();
    let text = fallback;
    if (low.startsWith('en')) {
      text = overrideEn || en || fallback;
    } else if (low.startsWith('tr')) {
      text = overrideTr || tr || fallback;
    }
    if (text) {
      map[locale] = text;
    }
  });

  if (!Object.keys(map).length && fallback) {
    map['en-US'] = fallback;
  }

  return Object.keys(map).length > 0 ? map : null;
}
