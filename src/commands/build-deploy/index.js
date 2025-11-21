const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const { confirm } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { ensureConfigFile, readConfig } = require('../../utils/config');
const { runCommand } = require('../../utils/process');
const { handlePromptExit } = require('../../utils/exitPrompt');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');
const { promptPlatformSelection: promptBuildPlatformSelection, getPlatformLabelKey: getBuildPlatformLabelKey } = require('../build/platformSelection');
const { promptAndroidFormatSelection, getFormatLabelKey } = require('../build/androidFormats');
const { getPubspecVersionInfo, promptVersionDecision } = require('../build/versionPrompt');
const { handleVersionBump } = require('../build/versionBump');
const { runAndroidBuild } = require('../build/androidBuild');
const { runIosBuild } = require('../build/iosBuild');
const { promptTargetSelection } = require('../deploy/targetSelection');
const { getPlatformLabelKey: getDeployPlatformLabelKey } = require('../deploy/platformSelection');
const { runAndroidDeploy } = require('../deploy/androidDeploy');
const { runIosDeploy } = require('../deploy/iosDeploy');

function registerBuildDeployCommand(program) {
  const buildDeploy = program.command('build-deploy').description(t('buildDeploy.description'));

  buildDeploy.action(async () => {
    try {
      if (!process.stdin.isTTY) {
        console.log(chalk.red(t('buildDeploy.error.nonInteractive')));
        buildDeploy.outputHelp();
        process.exitCode = 1;
        return;
      }

      ensureConfigFile();
      let config = readConfig();

      const platform = await promptBuildPlatformSelection();
      console.log(chalk.cyan(t('build.platform.selection', { value: t(getBuildPlatformLabelKey(platform)) })));

      let androidFormat = null;
      const shouldRunAndroid = platform === 'android' || platform === 'both';
      const shouldRunIos = platform === 'ios' || platform === 'both';

      if (shouldRunAndroid) {
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
          console.log(chalk.green(t('build.version.bump.applied', { version: bumpResult.version, build: bumpResult.build })));
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

      const ensuredConfig = await ensureSetupPrerequisites({ platform });
      if (!ensuredConfig) {
        console.log(chalk.yellow(t('setupFix.cancelled')));
        process.exitCode = 1;
        return;
      }
      config = ensuredConfig;

      console.log(chalk.blue(t('buildDeploy.info.start')));
      console.log(chalk.blue(t('buildDeploy.info.buildPhase')));

      if (!runPreBuildSteps(config)) {
        process.exitCode = 1;
        return;
      }

      const summary = {
        project: config.PROJECT_NAME || 'app',
        platform,
        version: finalVersion || versionInfo.version || t('common.unknownValue'),
        build: finalBuild || versionInfo.build || '0',
      };
      const artifactBaseName = buildArtifactBaseName({ config, summary });
      const artifacts = [];

      if (shouldRunAndroid) {
        try {
          const result = await runAndroidBuild({
            format: androidFormat || 'apk',
            config,
            summary,
            artifactBaseName,
          });
          artifacts.push({ platform: 'android', format: androidFormat || 'apk', ...result });
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

      logBuildOutputs(summary, artifacts);
      console.log(chalk.blue(t('buildDeploy.info.buildComplete')));

      console.log(chalk.blue(t('buildDeploy.info.deployPhase')));
      const deployResults = [];

      for (const artifact of artifacts) {
        const target = await promptTargetSelection({ platform: artifact.platform });
        console.log(
          chalk.green(
            t('deploy.target.selected', {
              platform: t(getDeployPlatformLabelKey(artifact.platform)),
              target: target.label,
            })
          )
        );

        try {
          if (artifact.platform === 'android') {
            const result = await runAndroidDeploy({
              artifact: { path: artifact.path, name: path.basename(artifact.path) },
              target,
              config,
            });
            deployResults.push({
              platform: 'android',
              target: target.label || target.key,
              path: result.artifact,
              sizeBytes: getItemSize(result.artifact),
              track: result.track,
            });
          } else if (artifact.platform === 'ios') {
            const result = await runIosDeploy({
              artifact: { path: artifact.path, name: path.basename(artifact.path) },
              target,
              config,
            });
            deployResults.push({
              platform: 'ios',
              target: target.label || target.key,
              path: result.path || result.artifact,
              sizeBytes: getItemSize(result.path || result.artifact),
            });
          }
        } catch (error) {
          if (artifact.platform === 'android' && error.codeAlreadyUsed) {
            const handled = await handleAndroidVersionRetry({
              error,
              target,
              config,
              format: artifact.format || 'apk',
            });
            if (handled && handled.path) {
              deployResults.push({
                platform: 'android',
                target: target.label || target.key,
                path: handled.path,
                sizeBytes: handled.sizeBytes || getItemSize(handled.path),
                track: target.key,
              });
              continue;
            }
            process.exitCode = 1;
            return;
          }
          console.log(chalk.red(error.message));
          process.exitCode = 1;
          return;
        }
      }

      logDeploySummary(deployResults);
      console.log(chalk.green(t('buildDeploy.info.complete')));
    } catch (error) {
      const handled = await handlePromptExit(error);
      if (!handled) {
        throw error;
      }
    }
  });

  return program;
}

module.exports = registerBuildDeployCommand;

function runPreBuildSteps(config) {
  if (!config || !config.BUILD_OUTPUT_DIR) {
    console.log(chalk.red(t('setupFix.failed')));
    return false;
  }

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

function logBuildOutputs(summary, artifacts) {
  if (!artifacts.length) {
    return;
  }

  console.log(chalk.blue.bold(t('build.summary.title')));
  console.log(chalk.cyan(`${t('build.summary.app')}: ${summary.project}`));
  console.log(chalk.cyan(`${t('build.summary.platform')}: ${t(getBuildPlatformLabelKey(summary.platform))}`));
  console.log(chalk.cyan(`${t('build.summary.version')}: ${summary.version} (Build: ${summary.build || 'N/A'})`));

  artifacts.forEach((artifact) => {
    console.log(
      chalk.cyan(
        t('build.summary.artifact', {
          platform: t(getBuildPlatformLabelKey(artifact.platform)),
        })
      )
    );
    console.log(chalk.yellow(`- ${t('build.summary.file')}: ${path.basename(artifact.path)}`));
    console.log(chalk.yellow(`- ${t('build.summary.size')}: ${formatBytes(artifact.sizeBytes)}`));
    console.log(chalk.yellow(`- ${t('build.summary.path')}: ${artifact.path}`));
  });
}

function logDeploySummary(results = []) {
  if (!results.length) {
    return;
  }

  console.log(chalk.blue.bold(t('deploy.summary.title')));
  results.forEach((item) => {
    const platformLabel = t(getDeployPlatformLabelKey(item.platform));
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

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const num = value / Math.pow(1024, i);
  return `${num.toFixed(num >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
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

async function handleAndroidVersionRetry({ error, target, config, format }) {
  const versionCode = error.versionCode || t('common.unknownValue');
  const wantBump = await confirm({
    message: t('deploy.retry.versionUsed.prompt', { code: versionCode }),
    default: true,
  });

  if (!wantBump) {
    console.log(chalk.yellow(t('deploy.retry.versionUsed.cancelled')));
    process.exitCode = 1;
    return null;
  }

  const ensured = await ensureSetupPrerequisites({ platform: 'android' });
  if (!ensured) {
    console.log(chalk.yellow(t('setupFix.cancelled')));
    process.exitCode = 1;
    return null;
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
    const artifactBaseName = buildArtifactBaseName({ config, summary: buildSummary });
    const buildResult = await runAndroidBuild({
      format: format || 'apk',
      config,
      summary: buildSummary,
      artifactBaseName,
    });

    showRebuildSummary(buildSummary, buildResult);

    const redeploy = await confirm({
      message: t('deploy.retry.versionUsed.redeployPrompt'),
      default: true,
    });

    if (!redeploy) {
      console.log(chalk.yellow(t('deploy.retry.versionUsed.cancelled')));
      process.exitCode = 1;
      return null;
    }

    const deployResult = await runAndroidDeploy({
      artifact: { path: buildResult.path, name: path.basename(buildResult.path) },
      target,
      config,
    });

    return { path: deployResult.artifact, sizeBytes: getItemSize(deployResult.artifact) };
  } catch (err) {
    console.log(chalk.red(t('deploy.retry.versionUsed.buildFailed', { message: err.message || t('common.unknownError') })));
    process.exitCode = 1;
    return null;
  }
}

function showRebuildSummary(summary, buildResult) {
  console.log(chalk.blue.bold(t('build.summary.title')));
  console.log(chalk.cyan(`${t('build.summary.app')}: ${summary.project}`));
  console.log(chalk.cyan(`${t('build.summary.platform')}: ${t(getBuildPlatformLabelKey(summary.platform))}`));
  console.log(chalk.cyan(`${t('build.summary.version')}: ${summary.version} (Build: ${summary.build || 'N/A'})`));
  console.log(chalk.cyan(t('build.summary.artifact', { platform: t(getBuildPlatformLabelKey(summary.platform)) })));
  console.log(chalk.yellow(`- ${t('build.summary.file')}: ${path.basename(buildResult.path)}`));
  console.log(chalk.yellow(`- ${t('build.summary.size')}: ${formatBytes(buildResult.sizeBytes)}`));
  console.log(chalk.yellow(`- ${t('build.summary.path')}: ${buildResult.path}`));
}
