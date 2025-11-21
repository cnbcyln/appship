const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { runCommand } = require('../../utils/process');
const { t } = require('../../i18n');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');

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

async function runAndroidBuild({ format = 'apk', config = {}, summary = {}, artifactBaseName }) {
  const ensured = await ensureSetupPrerequisites({ platform: 'android' });
  if (!ensured) {
    throw new Error(t('setupFix.cancelled'));
  }
  config = ensured;

  const validation = validateAndroidConfig(config);

  if (validation.missingSettings.length > 0 || validation.fileIssues.length > 0) {
    throw new Error(t('setupFix.failed'));
  }

  if (validation.outputDirMissing) {
    throw new Error(t('setupFix.failed'));
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

  const artifactPath = findAndroidArtifact(format);
  if (!artifactPath) {
    throw new Error(t('build.android.error.artifactMissing'));
  }

  const destinationDir = ensurePlatformOutputDir(validation.outputDir, 'android');
  const destinationPath = path.join(
    destinationDir,
    buildOutputFileName({ config, summary, artifactPath, format, artifactBaseName })
  );
  copyArtifact(artifactPath, destinationPath);

  console.log(chalk.green(t('build.android.info.success')));
  console.log(chalk.green(t('build.android.info.saved', { path: destinationPath })));
  return {
    format,
    path: destinationPath,
    sizeBytes: getItemSize(destinationPath),
  };
}

module.exports = {
  runAndroidBuild,
};

function buildOutputFileName({ config, summary = {}, artifactPath, format = 'apk', artifactBaseName }) {
  const baseName = artifactBaseName || buildDefaultBaseName(config, summary);
  const ext = resolveExtension(artifactPath, format);
  return `${baseName}${ext}`;
}

function buildDefaultBaseName(config, summary = {}) {
  const project = (config.PROJECT_NAME || 'app').toLowerCase();
  const buildNumber = (summary.build || '0').toString().toLowerCase();
  const timestamp = getTimestamp();
  return `${project}_${buildNumber}_${timestamp}`;
}

function findAndroidArtifact(format) {
  const projectRoot = process.cwd();
  const candidates =
    format === 'aab'
      ? [
          path.join(projectRoot, 'build', 'app', 'outputs', 'bundle', 'release', 'app-release.aab'),
          path.join(projectRoot, 'build', 'app', 'outputs', 'bundle', 'app-release.aab'),
        ]
      : [
          path.join(projectRoot, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'),
          path.join(projectRoot, 'build', 'app', 'outputs', 'apk', 'release', 'app-release.apk'),
        ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const searchRoot = path.join(projectRoot, 'build', 'app', 'outputs');
  const ext = format === 'aab' ? '.aab' : '.apk';
  return findFirstFileWithExtension(searchRoot, ext);
}

function findFirstFileWithExtension(root, extension) {
  const maxDepth = 4;
  try {
    return traverse(root, 0);
  } catch {
    return null;
  }

  function traverse(current, depth) {
    if (depth > maxDepth) {
      return null;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return null;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const found = traverse(fullPath, depth + 1);
        if (found) return found;
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
        return fullPath;
      }
    }
    return null;
  }
}

function ensurePlatformOutputDir(baseDir, platform) {
  const target = path.join(baseDir, platform);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

function copyArtifact(source, destination) {
  fs.copyFileSync(source, destination);
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function resolveExtension(artifactPath, format) {
  if (artifactPath) {
    const extname = path.extname(artifactPath);
    if (extname) {
      return extname.toLowerCase();
    }
  }
  return format === 'aab' ? '.aab' : '.apk';
}

function getItemSize(target) {
  try {
    const stats = fs.statSync(target);
    if (stats.isFile()) {
      return stats.size;
    }
  } catch {
    return 0;
  }

  return 0;
}
