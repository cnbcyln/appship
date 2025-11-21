const fs = require('fs');
const path = require('path');
const { selectWithBack } = require('../../utils/selectWithBack');
const { t } = require('../../i18n');

function getPubspecVersionInfo() {
  const pubspecPath = path.join(process.cwd(), 'pubspec.yaml');
  const info = {
    version: null,
    build: null,
    raw: null,
    warningKey: null,
    path: pubspecPath,
  };

  let content;
  try {
    content = fs.readFileSync(pubspecPath, 'utf8');
  } catch (error) {
    info.warningKey = 'build.version.warning.missingPubspec';
    return info;
  }

  const versionMatch = content.match(/^\s*version\s*:\s*([^\r\n]+)/m);
  if (!versionMatch) {
    info.warningKey = 'build.version.warning.noVersion';
    return info;
  }

  info.raw = versionMatch[1].trim();
  if (!info.raw) {
    info.warningKey = 'build.version.warning.noVersion';
    return info;
  }

  const [versionPart, buildPart] = info.raw.split('+');
  info.version = versionPart ? versionPart.trim() : null;
  info.build = buildPart ? buildPart.trim() : null;
  return info;
}

async function promptVersionDecision(info = {}) {
  const versionDisplay = info.version || t('common.unknownValue');
  const buildDisplay = info.build || t('common.unknownValue');

  const decision = await selectWithBack({
    message: t('build.version.menu.prompt', { version: versionDisplay }),
    choices: [
      { value: 'bump', name: t('build.version.menu.bump') },
      {
        value: 'keep',
        name: t('build.version.menu.keep', { version: versionDisplay, build: buildDisplay }),
      },
    ],
  });

  if (!decision) {
    return null;
  }

  return {
    decision,
    versionDisplay,
    buildDisplay,
  };
}

module.exports = {
  getPubspecVersionInfo,
  promptVersionDecision,
};
