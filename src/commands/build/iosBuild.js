const fs = require('fs');
const path = require('path');
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

async function runIosBuild({ config = {}, summary = {} }) {
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
  const result = runCommand('flutter', ['build', 'ipa', '--release'], { inherit: true });

  if (!result.success) {
    throw new Error(t('build.ios.error.buildFailed'));
  }

  const artifactPath = findIosArtifact();
  if (!artifactPath) {
    throw new Error(t('build.ios.error.artifactMissing'));
  }

  const destinationDir = ensurePlatformOutputDir(validation.outputDir, 'ios');
  const destinationPath = path.join(destinationDir, buildOutputFileName(config, 'ios', summary, artifactPath));
  copyArtifact(artifactPath, destinationPath);

  console.log(chalk.green(t('build.ios.info.success')));
  console.log(chalk.green(t('build.ios.info.saved', { path: destinationPath })));
  return {
    path: destinationPath,
    sizeBytes: getItemSize(destinationPath),
  };
}

module.exports = {
  runIosBuild,
};

function buildOutputFileName(config, platform, summary = {}) {
  const project = (config.PROJECT_NAME || 'app').toLowerCase();
  const buildNumber = (summary.build || '0').toString().toLowerCase();
  const timestamp = getTimestamp();
  return `${project}_${buildNumber}_${timestamp}.ipa`;
}

function findIosArtifact() {
  const projectRoot = process.cwd();
  const ipaDir = path.join(projectRoot, 'build', 'ios', 'ipa');
  const ipa = findFirstFileWithExtension(ipaDir, '.ipa');
  if (ipa) {
    return ipa;
  }

  return null;
}

function findFirstFileWithExtension(root, extension) {
  const maxDepth = 3;
  if (!root || !fs.existsSync(root)) {
    return null;
  }

  return traverse(root, 0);

  function traverse(current, depth) {
    if (depth > maxDepth) {
      return null;
    }

    let entries;
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
  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    fs.cpSync(source, destination, { recursive: true, force: true });
  } else {
    fs.copyFileSync(source, destination);
  }
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getItemSize(target) {
  try {
    const stats = fs.statSync(target);
    if (stats.isFile()) {
      return stats.size;
    }
    if (stats.isDirectory()) {
      return calculateDirectorySize(target);
    }
  } catch {
    return 0;
  }
  return 0;
}

function calculateDirectorySize(dir) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const fileStats = fs.statSync(fullPath);
        total += fileStats.size;
      }
    }
  } catch {
    return total;
  }
  return total;
}
