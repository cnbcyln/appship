const fs = require('fs');
const path = require('path');
const { selectWithBack } = require('../../utils/navigation');
const chalk = require('chalk');
const { t } = require('../../i18n');
const { getPlatformLabelKey } = require('./platformSelection');

async function promptArtifactSelection({ platform, baseOutputDir }) {
  const artifacts = collectArtifacts(baseOutputDir, platform);
  if (!artifacts.length) {
    console.log(chalk.red(t('deploy.error.noArtifacts', { platform: t(getPlatformLabelKey(platform)) })));
    return null;
  }

  const choice = await selectWithBack({
    allowBack: true,
    message: t('deploy.output.menu.prompt', { platform: t(getPlatformLabelKey(platform)) }),
    choices: artifacts.map((artifact) => ({
      value: artifact,
      name: formatArtifactLabel(artifact),
    })),
  });

  return choice === null ? null : choice;
}

function collectArtifacts(baseOutputDir, platform) {
  const targetDir = path.join(baseOutputDir, platform);
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = path.join(targetDir, entry.name);
      const stats = safeStat(fullPath);
      return stats
        ? {
            name: entry.name,
            path: fullPath,
            size: stats.size || 0,
            mtimeMs: stats.mtimeMs || 0,
          }
        : null;
    })
    .filter(Boolean);

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files;
}

function safeStat(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const num = value / Math.pow(1024, i);
  return `${num.toFixed(num >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatArtifactLabel(artifact) {
  const meta = parseArtifactMeta(artifact.name);
  const build = meta.build || t('common.unknownValue');
  const date = meta.date || t('common.unknownValue');
  const time = meta.time || t('common.unknownValue');
  const size = formatBytes(artifact.size);

  return t('deploy.output.label', {
    file: artifact.name,
    size,
    build,
    date,
    time,
  });
}

function parseArtifactMeta(filename) {
  const match = filename.match(/^[^_]+_([0-9]+)_([0-9]{8})_([0-9]{6})/);
  if (!match) {
    return {};
  }

  const [, build, datePart, timePart] = match;
  return {
    build,
    date: formatDate(datePart),
    time: formatTime(timePart),
  };
}

function formatDate(value) {
  if (!/^[0-9]{8}$/.test(value)) return null;
  const day = value.slice(0, 2);
  const month = value.slice(2, 4);
  const year = value.slice(4);
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!/^[0-9]{6}$/.test(value)) return null;
  const hour = value.slice(0, 2);
  const minute = value.slice(2, 4);
  const second = value.slice(4);
  return `${hour}:${minute}:${second}`;
}

module.exports = {
  promptArtifactSelection,
  collectArtifacts,
};
