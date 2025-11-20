const chalk = require('chalk');
const { confirm } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const path = require('path');
const { ensureConfigFile } = require('../../utils/config');
const { runCommand } = require('../../utils/process');
const { promptPlatformSelection, getPlatformLabelKey } = require('./platformSelection');
const { promptAndroidFormatSelection, getFormatLabelKey } = require('./androidFormats');
const { getPubspecVersionInfo, promptVersionDecision } = require('./versionPrompt');
const { handleVersionBump } = require('./versionBump');
const { runAndroidBuild } = require('./androidBuild');
const { runIosBuild } = require('./iosBuild');

function registerBuildCommand(program) {
  const build = program.command('build').description(t('build.description'));

  build.action(async () => {
    if (!process.stdin.isTTY) {
      console.log(chalk.red(t('build.error.nonInteractive')));
      build.outputHelp();
      process.exitCode = 1;
      return;
    }

    const config = ensureConfigFile();
    const platform = await promptPlatformSelection();
    console.log(chalk.cyan(t('build.platform.selection', { value: t(getPlatformLabelKey(platform)) })));

    let androidFormat = null;
    if (platform === 'android' || platform === 'both') {
      androidFormat = await promptAndroidFormatSelection();
      console.log(chalk.cyan(t('build.format.selection', { value: t(getFormatLabelKey(androidFormat)) })));
    }

    const versionInfo = getPubspecVersionInfo();
    if (versionInfo.warningKey) {
      console.log(chalk.yellow(t(versionInfo.warningKey)));
    }

    const versionDecision = await promptVersionDecision(versionInfo);
    let finalVersion = versionDecision.versionDisplay;
    let finalBuild = versionDecision.buildDisplay;

    if (versionDecision.decision === 'bump') {
      try {
        const bumpResult = await handleVersionBump(versionInfo);
        finalVersion = bumpResult.version;
        finalBuild = bumpResult.build;
        console.log(
          chalk.green(
            t('build.version.bump.applied', {
              version: bumpResult.version,
              build: bumpResult.build,
            })
          )
        );
      } catch (error) {
        console.log(chalk.red(t('build.version.error.updateFailed', { message: error.message })));
        process.exitCode = 1;
        return;
      }
    } else {
      console.log(
        chalk.cyan(
          t('build.version.selection.keep', {
            version: versionDecision.versionDisplay,
            build: versionDecision.buildDisplay,
          })
        )
      );
    }

    const summary = {
      project: config.PROJECT_NAME || 'app',
      platform,
      version: finalVersion || versionInfo.version || t('common.unknownValue'),
      build: finalBuild || versionInfo.build || '0',
    };
    const artifactBaseName = buildArtifactBaseName({ config, summary });

    if (!runPreBuildSteps()) {
      process.exitCode = 1;
      return;
    }

    const shouldRunAndroid = platform === 'android' || platform === 'both';
    const shouldRunIos = platform === 'ios' || platform === 'both';
    const artifacts = [];

    if (shouldRunAndroid) {
      try {
        const result = await runAndroidBuild({
          format: androidFormat || 'apk',
          config,
          summary,
          artifactBaseName,
        });
        artifacts.push({ platform: 'android', ...result });
      } catch (error) {
        console.log(chalk.red(error.message));
        process.exitCode = 1;
        return;
      }
    }

    if (shouldRunIos) {
      try {
        const result = await runIosBuild({ config, summary, artifactBaseName });
        artifacts.push({ platform: 'ios', ...result });
      } catch (error) {
        console.log(chalk.red(error.message));
        process.exitCode = 1;
        return;
      }
    }

    logBuildSummary(summary, artifacts);
    await promptOpenOutputFolder(config, platform);
  });

  return program;
}

module.exports = registerBuildCommand;

function logBuildSummary(summary, artifacts) {
  console.log(chalk.blue.bold(t('build.summary.title')));
  console.log(chalk.cyan(`${t('build.summary.app')}: ${summary.project}`));
  console.log(chalk.cyan(`${t('build.summary.platform')}: ${t(getPlatformLabelKey(summary.platform))}`));
  console.log(chalk.cyan(`${t('build.summary.version')}: ${summary.version} (Build: ${summary.build || 'N/A'})`));

  artifacts.forEach((artifact) => {
    console.log(
      chalk.cyan(
        t('build.summary.artifact', {
          platform: t(getPlatformLabelKey(artifact.platform)),
        })
      )
    );
    console.log(chalk.yellow(`- ${t('build.summary.file')}: ${path.basename(artifact.path)}`));
    console.log(chalk.yellow(`- ${t('build.summary.size')}: ${formatBytes(artifact.sizeBytes)}`));
    console.log(chalk.yellow(`- ${t('build.summary.path')}: ${artifact.path}`));
  });
}

function runPreBuildSteps() {
  console.log(chalk.blue(t('build.common.info.flutterClean')));
  const clean = runCommand('flutter', ['clean'], { inherit: true });
  if (!clean.success) {
    console.log(chalk.red(t('build.common.error.flutterCleanFailed')));
    return false;
  }

  console.log(chalk.blue(t('build.common.info.flutterPubGet')));
  const pubGet = runCommand('flutter', ['pub', 'get'], { inherit: true });
  if (!pubGet.success) {
    console.log(chalk.red(t('build.common.error.flutterPubGetFailed')));
    return false;
  }

  return true;
}

async function promptOpenOutputFolder(config, platform) {
  const baseDir = (config.BUILD_OUTPUT_DIR || '').trim();
  if (!baseDir) {
    return;
  }

  const open = await confirm({
    message: t('build.summary.openPrompt'),
    default: false
  });

  if (!open) {
    return;
  }

  const targetDir = platform === 'both' ? baseDir : path.join(baseDir, platform);
  const result = runCommand('open', [targetDir]);
  if (!result.success) {
    console.log(chalk.yellow(t('build.summary.openFolderFailed', { path: targetDir })));
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

function buildArtifactBaseName({ config, summary }) {
  const project = (config.PROJECT_NAME || 'app').toLowerCase();
  const buildNumber = (summary.build || '0').toString().toLowerCase();
  const timestamp = getTimestamp();
  return `${project}_${buildNumber}_${timestamp}`;
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
