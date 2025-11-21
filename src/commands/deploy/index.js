const chalk = require('chalk');
const { confirm, input } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { ensureConfigFile, readConfig } = require('../../utils/config');
const { promptPlatformSelection, getPlatformLabelKey } = require('./platformSelection');
const { promptArtifactSelection } = require('./outputSelection');
const { promptTargetSelection } = require('./targetSelection');
const { runAndroidDeploy } = require('./androidDeploy');
const { runIosDeploy } = require('./iosDeploy');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');
const { handlePromptExit } = require('../../utils/exitPrompt');
const path = require('path');
const fs = require('fs');
const { getPubspecVersionInfo } = require('../build/versionPrompt');
const { handleVersionBump } = require('../build/versionBump');
const { runAndroidBuild } = require('../build/androidBuild');

function registerDeployCommand(program) {
  const deploy = program.command('deploy').description(t('deploy.description'));

  deploy.action(async () => {
    while (true) {
      try {
      if (!process.stdin.isTTY) {
        console.log(chalk.red(t('deploy.error.nonInteractive')));
        deploy.outputHelp();
        process.exitCode = 1;
        return;
      }

    const platform = await promptPlatformSelection();
    if (!platform) break;
    //console.log(chalk.cyan(t('deploy.platform.selection', { value: t(getPlatformLabelKey(platform)) })));

    ensureConfigFile();
    let config = readConfig();

    const selections = {};
    let baseOutputDir = (config.BUILD_OUTPUT_DIR || '').trim();
    if (platform === 'both') {
      const androidResult = await handlePlatformSelection({ platform: 'android', baseOutputDir });
      if (!androidResult) {
        continue;
      }
      selections.android = androidResult;

      const iosResult = await handlePlatformSelection({ platform: 'ios', baseOutputDir });
      if (!iosResult) {
        continue;
      }
      selections.ios = iosResult;
    } else {
      const result = await handlePlatformSelection({ platform, baseOutputDir });
      if (!result) {
        continue;
      }
      selections[platform] = result;
    }

    const deployResults = [];

    if (platform === 'both') {
      const okAndroid = await deployPlatform({ platform: 'android', selections, config });
      if (!okAndroid) {
        process.exitCode = 1;
        return;
      }
      deployResults.push(okAndroid);
      const okIos = await deployPlatform({ platform: 'ios', selections, config });
      if (!okIos) {
        process.exitCode = 1;
        return;
      }
      deployResults.push(okIos);
    } else if (platform === 'android') {
      const ok = await deployPlatform({ platform: 'android', selections, config });
      if (!ok) {
        process.exitCode = 1;
        return;
      }
      deployResults.push(ok);
    } else if (platform === 'ios') {
      const ok = await deployPlatform({ platform: 'ios', selections, config });
      if (!ok) {
        process.exitCode = 1;
        return;
      }
      deployResults.push(ok);
    }

    logDeploySummary(deployResults);
      break;
      } catch (error) {
        const handled = await handlePromptExit(error);
        if (handled === 'resume') {
          continue;
        }
        if (!handled) {
          throw error;
        }
        break;
      }
    }
  });

  return program;
}

module.exports = registerDeployCommand;

async function handlePlatformSelection({ platform, baseOutputDir }) {
  let artifact = null;
  let target = null;
  let step = 'artifact';

  while (true) {
    if (step === 'artifact') {
      artifact = await promptArtifactSelection({ platform, baseOutputDir });
      if (!artifact) {
        return null;
      }
      const meta = extractArtifactMeta(artifact);
      /* console.log(
        chalk.green(
          t('deploy.output.selectedDetailed', {
            platform: t(getPlatformLabelKey(platform)),
            file: artifact.name,
            size: formatBytes(meta.sizeBytes),
            build: meta.build || t('common.unknownValue'),
            date: meta.date || t('common.unknownValue'),
            time: meta.time || t('common.unknownValue'),
          })
        )
      ); */
      step = 'target';
      continue;
    }

    if (step === 'target') {
      target = await promptTargetSelection({ platform });
      if (!target) {
        step = 'artifact';
        continue;
      }
      console.log(chalk.green(t('deploy.target.selected', { platform: t(getPlatformLabelKey(platform)), target: target.label })));
      break;
    }
  }

  const releaseNotes = await promptReleaseNotes();
  return { artifact, target, releaseNotes };
}

async function deployPlatform({ platform, selections, config }) {
  const selection = selections[platform];
  if (!selection) {
    return false;
  }

  try {
    if (platform === 'android') {
      const result = await runAndroidDeploy({
        artifact: selection.artifact,
        target: selection.target,
        config,
        releaseNotes: selection.releaseNotes,
      });
      return {
        platform: 'android',
        target: selection.target.label || selection.target.key,
        track: result.track,
        path: result.artifact,
        sizeBytes: getItemSize(result.artifact),
      };
    } else if (platform === 'ios') {
      const result = await runIosDeploy({
        artifact: selection.artifact,
        target: selection.target,
        config,
        releaseNotes: selection.releaseNotes,
      });
      return {
        platform: 'ios',
        target: selection.target.label || selection.target.key,
        path: result.path || result.artifact,
        sizeBytes: getItemSize(result.path || result.artifact),
      };
    }
  } catch (error) {
    if (platform === 'android' && error.codeAlreadyUsed) {
      const handled = await handleAndroidVersionRetry({
        error,
        selection,
        config,
        releaseNotes: selection.releaseNotes,
      });
      if (handled && handled.path) {
        return {
          platform: 'android',
          target: selection.target.label || selection.target.key,
          track: selection.target.key,
          path: handled.path,
          sizeBytes: getItemSize(handled.path),
        };
      }
      return false;
    }
    console.log(chalk.red(error.message));
    process.exitCode = 1;
    return false;
  }
}

function extractArtifactMeta(artifact) {
  const meta = parseArtifactMetaFromName(artifact.name);
  return {
    ...meta,
    sizeBytes: artifact.size || getItemSize(artifact.path),
  };
}

function parseArtifactMetaFromName(filename) {
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

async function handleAndroidVersionRetry({ error, selection, config, releaseNotes }) {
  const versionCode = error.versionCode || t('common.unknownValue');
  const wantBump = await confirm({
    message: t('deploy.retry.versionUsed.prompt', { code: versionCode }),
    default: true,
  });

  if (!wantBump) {
    console.log(chalk.yellow(t('deploy.retry.versionUsed.cancelled')));
    process.exitCode = 1;
    return false;
  }

  const ensured = await ensureSetupPrerequisites({ platform: 'android' });
  if (!ensured) {
    console.log(chalk.yellow(t('setupFix.cancelled')));
    process.exitCode = 1;
    return false;
  }
  config = ensured;

  const versionInfo = getPubspecVersionInfo();
  if (versionInfo.warningKey) {
    console.log(chalk.yellow(t(versionInfo.warningKey)));
  }

  try {
    const bumpResult = await handleVersionBump(versionInfo);
    console.log(chalk.green(t('deploy.retry.versionUsed.bumped', { version: bumpResult.version, build: bumpResult.build })));

    const buildSummary = {
      project: config.PROJECT_NAME || 'app',
      platform: 'android',
      version: bumpResult.version,
      build: bumpResult.build,
    };

    const format = selection.artifact.path.toLowerCase().endsWith('.aab') ? 'aab' : 'apk';
    const buildResult = await runAndroidBuild({
      format,
      config,
      summary: buildSummary,
    });

    showRebuildSummary(buildSummary, buildResult);

    const redeploy = await confirm({
      message: t('deploy.retry.versionUsed.redeployPrompt'),
      default: true,
    });

    if (!redeploy) {
      console.log(chalk.yellow(t('deploy.retry.versionUsed.cancelled')));
      process.exitCode = 1;
      return false;
    }

    await runAndroidDeploy({
      artifact: { path: buildResult.path, name: buildResult.path.split('/').pop() },
      target: selection.target,
      config,
      releaseNotes,
    });

    return { path: buildResult.path };
  } catch (err) {
    console.log(chalk.red(t('deploy.retry.versionUsed.buildFailed', { message: err.message || t('common.unknownError') })));
    process.exitCode = 1;
    return false;
  }
}

function showRebuildSummary(summary, buildResult) {
  console.log(chalk.blue.bold(t('build.summary.title')));
  console.log(chalk.cyan(`${t('build.summary.app')}: ${summary.project}`));
  console.log(chalk.cyan(`${t('build.summary.platform')}: ${t(getPlatformLabelKey(summary.platform))}`));
  console.log(chalk.cyan(`${t('build.summary.version')}: ${summary.version} (Build: ${summary.build || 'N/A'})`));
  console.log(chalk.cyan(t('build.summary.artifact', { platform: t(getPlatformLabelKey(summary.platform)) })));
  console.log(chalk.yellow(`- ${t('build.summary.file')}: ${path.basename(buildResult.path)}`));
  console.log(chalk.yellow(`- ${t('build.summary.size')}: ${formatBytes(buildResult.sizeBytes)}`));
  console.log(chalk.yellow(`- ${t('build.summary.path')}: ${buildResult.path}`));
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const num = value / Math.pow(1024, i);
  return `${num.toFixed(num >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function logDeploySummary(results = []) {
  if (!results.length) {
    return;
  }

  console.log(chalk.blue.bold(t('deploy.summary.title')));
  results.forEach((item) => {
    const platformLabel = t(getPlatformLabelKey(item.platform));
    console.log(chalk.cyan(`${t('deploy.summary.platform')}: ${platformLabel}`));
    if (item.target) {
      console.log(chalk.cyan(`${t('deploy.summary.target')}: ${item.target}`));
    }
    console.log(chalk.yellow(`- ${t('build.summary.file')}: ${path.basename(item.path || '')}`));
    console.log(chalk.yellow(`- ${t('build.summary.size')}: ${formatBytes(item.sizeBytes)}`));
    console.log(chalk.yellow(`- ${t('build.summary.path')}: ${item.path}`));
    console.log('');
  });
}

function getItemSize(target) {
  try {
    const stats = fs.statSync(target);
    if (stats.isFile()) return stats.size;
  } catch {
    return 0;
  }
  return 0;
}

async function promptReleaseNotes() {
  console.log(chalk.blue(t('deploy.releaseNotes.info')));

  ensureConfigFile();
  const cfg = readConfig();
  const defaultTr = (cfg.RELEASE_NOTES_TR || '').trim();
  const defaultEn = (cfg.RELEASE_NOTES_EN || '').trim();

  const noteTr = await input({
    message: t('deploy.releaseNotes.prompt.tr'),
    default: defaultTr,
  });

  const noteEn = await input({
    message: t('deploy.releaseNotes.prompt.en'),
    default: defaultEn,
  });

  const trimmedEn = (noteEn || '').trim();
  const trimmedTr = (noteTr || '').trim();

  if (!trimmedEn && !trimmedTr) {
    return null;
  }

  return {
    tr: trimmedTr || defaultTr,
    en: trimmedEn || defaultEn,
  };
}
