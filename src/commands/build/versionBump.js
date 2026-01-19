const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { selectWithBack } = require('../../utils/navigation');
const { t } = require('../../i18n');
const { promptRequiredInput } = require('../../utils/promptRequiredInput');

function parseSemver(value) {
  const numericParts = (value || '').trim();
  const match = numericParts.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0, valid: false };
  }

  return {
    major: Number(match[1]) || 0,
    minor: Number(match[2]) || 0,
    patch: Number(match[3]) || 0,
    valid: true,
  };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function normalizeVersionInfo(info = {}) {
  const parsed = parseSemver(info.version || '0.0.0');
  return {
    currentVersion: parsed.valid ? formatSemver(parsed) : '0.0.0',
    currentVersionDisplay: info.version || '0.0.0',
    versionParts: parsed,
    currentBuild: Number.isInteger(Number(info.build)) ? Number(info.build) : 0,
    currentBuildDisplay: info.build || '0',
    pubspecPath: info.path || path.join(process.cwd(), 'pubspec.yaml'),
  };
}

function computeBumpTarget(base, type) {
  const { major, minor, patch } = { ...base.versionParts };
  let nextMajor = major;
  let nextMinor = minor;
  let nextPatch = patch;

  switch (type) {
    case 'major':
      nextMajor += 1;
      nextMinor = 0;
      nextPatch = 0;
      break;
    case 'minor':
      nextMinor += 1;
      nextPatch = 0;
      break;
    case 'build':
      // Only build number increments, version stays same
      break;
    case 'patch':
    default:
      // Default to patch bump (standard behavior)
      nextPatch += 1;
      break;
  }

  const nextBuild = base.currentBuild + 1;
  return {
    version: formatSemver({ major: nextMajor, minor: nextMinor, patch: nextPatch }),
    build: String(nextBuild),
  };
}

async function promptBumpType(base, { allowBack = true } = {}) {
  const options = ['major', 'minor', 'patch'];
  const choices = options.map((type) => {
    const next = computeBumpTarget(base, type);
    return {
      value: type,
      name: t(`build.version.bump.menu.${type}`, {
        current: base.currentVersion,
        next: next.version,
        currentBuild: base.currentBuildDisplay,
        nextBuild: next.build,
      }),
    };
  });

  choices.push({ value: 'manual', name: t('build.version.bump.menu.manual') });

  const selection = await selectWithBack({
    allowBack,
    message: t('build.version.bump.menu.prompt'),
    choices,
  });

  return selection === null ? null : selection;
}

function isNewerVersion(baseParts, candidateParts) {
  if (candidateParts.major !== baseParts.major) {
    return candidateParts.major > baseParts.major;
  }
  if (candidateParts.minor !== baseParts.minor) {
    return candidateParts.minor > baseParts.minor;
  }
  return candidateParts.patch > baseParts.patch;
}

async function promptManualVersion(base) {
  let version;
  while (true) {
    const input = await promptRequiredInput({
      message: t('build.version.manual.versionPrompt', { current: base.currentVersion }),
      defaultValue: '',
      errorMessage: t('build.version.manual.errorInvalidFormat'),
    });

    const parsed = parseSemver(input);
    if (!parsed.valid) {
      console.log(chalk.red(t('build.version.manual.errorInvalidFormat')));
      continue;
    }

    if (!isNewerVersion(base.versionParts, parsed)) {
      console.log(chalk.red(t('build.version.manual.errorHigherVersion', { current: base.currentVersion })));
      continue;
    }

    version = formatSemver(parsed);
    break;
  }

  let build;
  while (true) {
    const input = await promptRequiredInput({
      message: t('build.version.manual.buildPrompt', { current: base.currentBuildDisplay }),
      defaultValue: '',
      errorMessage: t('build.version.manual.errorInvalidBuild'),
    });

    if (!/^\d+$/.test(input)) {
      console.log(chalk.red(t('build.version.manual.errorInvalidBuild')));
      continue;
    }

    if (Number(input) <= base.currentBuild) {
      console.log(chalk.red(t('build.version.manual.errorHigherBuild', { current: base.currentBuildDisplay })));
      continue;
    }

    build = input;
    break;
  }

  return { version, build };
}

function updatePubspecVersion(pubspecPath, version, build) {
  const resolvedPath = pubspecPath || path.join(process.cwd(), 'pubspec.yaml');
  let content;
  try {
    content = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    throw new Error(t('build.version.error.missingPubspec'));
  }

  const newValue = `version: ${version}${build ? `+${build}` : ''}`;
  const versionRegex = /^(\s*version\s*:\s*).+$/m;

  if (versionRegex.test(content)) {
    content = content.replace(versionRegex, `$1${version}${build ? `+${build}` : ''}`);
  } else {
    content = `${newValue}\n${content}`;
  }

  fs.writeFileSync(resolvedPath, content, 'utf8');
}

async function handleVersionBump(versionInfo = {}, { allowBack = true } = {}) {
  const base = normalizeVersionInfo(versionInfo);
  const bumpType = await promptBumpType(base, { allowBack });
  if (!bumpType) {
    return null;
  }

  let target;
  if (bumpType === 'manual') {
    target = await promptManualVersion(base);
  } else {
    target = computeBumpTarget(base, bumpType);
  }

  updatePubspecVersion(base.pubspecPath, target.version, target.build);

  return {
    updated: true,
    version: target.version,
    build: target.build,
    method: bumpType,
  };
}

async function applyVersionBump(versionInfo = {}, strategy) {
  const base = normalizeVersionInfo(versionInfo);
  // strategy: major, minor, patch, build

  // Note: 'manual' strategy is not supported via this simple interface,
  // users should use interactive mode or we need to add --new-version flag

  const target = computeBumpTarget(base, strategy);
  updatePubspecVersion(base.pubspecPath, target.version, target.build);

  return {
    updated: true,
    version: target.version,
    build: target.build,
    method: strategy,
  };
}

module.exports = {
  handleVersionBump,
  applyVersionBump,
  normalizeVersionInfo,
};
