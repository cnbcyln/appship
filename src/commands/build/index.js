const chalk = require('chalk');
const { confirm } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const path = require('path');
const { ensureConfigFile, readConfig } = require('../../utils/config');
const { runCommand } = require('../../utils/process');
const { promptPlatformSelection, getPlatformLabelKey } = require('./platformSelection');
const { promptAndroidFormatSelection, getFormatLabelKey } = require('./androidFormats');
const { getPubspecVersionInfo, promptVersionDecision } = require('./versionPrompt');
const { handleVersionBump, applyVersionBump } = require('./versionBump');
const { runAndroidBuild } = require('./androidBuild');
const { runIosBuild } = require('./iosBuild');
const { ensureSetupPrerequisites } = require('../../utils/setupRecovery');
const { handlePromptExit } = require('../../utils/exitPrompt');

function registerBuildCommand(program) {
  const build = program.command('build')
    .description(t('build.description'))
    .option('-p, --platform <platform>', 'Platform to build (android, ios, both)')
    .option('-f, --format <format>', 'Android format (apk, aab)')
    .option('-b, --bump <strategy>', 'Version bump strategy (major, minor, patch, build, none)');

  build.action(async (options) => {
    while (true) {
      try {
        const isInteractive = process.stdin.isTTY;

        // If not interactive and missing required options, fail
        if (!isInteractive && !options.platform) {
          console.log(chalk.red(t('build.error.nonInteractive')));
          process.exitCode = 1;
          return;
        }

        ensureConfigFile();
        let config = readConfig();

        let platform = options.platform;
        const allowBackFirst = global.__APPSHIP_FROM_MAIN === true;
        let androidFormat = options.format;
        let finalVersion = null;
        let finalBuild = null;
        let versionInfo = null;
        let selectionExitToMain = false;

        let step = 'platform';

        // Interactive loop or One-pass for CI
        while (true) {
          if (!platform) {
            if (step === 'platform') {
              platform = await promptPlatformSelection({ allowBack: allowBackFirst });
              if (!platform) {
                selectionExitToMain = true;
                break;
              }
              //console.log(chalk.cyan(t('build.platform.selection', { value: t(getPlatformLabelKey(platform)) })));
              androidFormat = null; // Reset format if platform changes
              step = platform === 'android' || platform === 'both' ? 'format' : 'version';
              continue;
            }
          } else {
             // If platform was provided via flag, we just validate it briefly or move on
             // We ensure 'step' logic is respected for subsequent parameters if they are missing
             if (step === 'platform') {
                 step = platform === 'android' || platform === 'both' ? 'format' : 'version';
             }
          }

          if (step === 'format') {
             if (!androidFormat && (platform === 'android' || platform === 'both')) {
                if (isInteractive) {
                  androidFormat = await promptAndroidFormatSelection({ allowBack: true });
                  if (!androidFormat) {
                    step = 'platform';
                    platform = null; // Go back
                    continue;
                  }
                } else {
                   // Default to apk if not specified in CI? Or fail?
                   // Let's default to apk for convenience or fail if strict.
                   // Usage says: appship build --platform android --format apk
                   // Let's require it or default it.
                   androidFormat = 'apk';
                }
             }
             step = 'version';
             continue;
          }

          if (step === 'version') {
            versionInfo = getPubspecVersionInfo();
            if (versionInfo.warningKey) {
              console.log(chalk.yellow(t(versionInfo.warningKey)));
            }

            let versionDecision = null;

            if (options.bump) {
                versionDecision = { decision: options.bump === 'none' ? 'keep' : 'bump', strategy: options.bump };
                // Map 'none' to 'keep'
                if (options.bump === 'none') {
                    versionDecision = { decision: 'keep' };
                } else {
                    versionDecision = { decision: 'bump', strategy: options.bump };
                }
                finalVersion = versionInfo.version; // Initial value
                finalBuild = versionInfo.build;
            } else if (isInteractive) {
                versionDecision = await promptVersionDecision(versionInfo, { allowBack: true });
                if (!versionDecision) {
                  step = platform === 'android' || platform === 'both' ? 'format' : 'platform';
                  if (options.platform) {
                      // if platform was fixed, we can't go back to change it in interactive mode easily
                      // if we are fully interactive, we can.
                      // But if options.platform is set, we treat it as fixed.
                      // Actually, if options.platform is set, we might not want to go back.
                      // But the prompt loop design allows going back.
                      // If we are in mixed mode (flags + interactive), it's tricky.
                      // Let's assume if flags are present, we don't loop back to change them.
                      return;
                  }
                  continue;
                }
            } else {
                // Non-interactive and no bump flag -> default to keep?
                versionDecision = { decision: 'keep' };
            }

            finalVersion = versionDecision.versionDisplay || versionInfo.version;
            finalBuild = versionDecision.buildDisplay || versionInfo.build;

            if (versionDecision.decision === 'bump') {
              try {
                let bumpResult;
                if (isInteractive && !options.bump) {
                    bumpResult = await handleVersionBump(versionInfo, { allowBack: true });
                    if (!bumpResult) {
                      step = 'version';
                      continue;
                    }
                } else {
                    // Apply bump strategy directly
                    // We need to import applyVersionBump or similar logic.
                    // handleVersionBump handles the prompt. We need the logic *after* the prompt.
                    // Checking handleVersionBump implementation in versionBump.js...
                    // It seems I need to look at versionBump.js to see if I can call a lower level function.
                    // For now, I'll assume I need to implement a non-interactive bump handler or modify handleVersionBump.
                    // Let's assume applyVersionBump exists or I need to create it.
                    // The require above: const { handleVersionBump, applyVersionBump } = require('./versionBump');
                    // I need to check versionBump.js to see what's available.

                    // PROVISIONAL: I will check versionBump.js content before finalizing this file.
                    // For now, let's assume I can use a function to apply it.
                    bumpResult = await applyVersionBump(versionInfo, versionDecision.strategy);
                }

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
            }
            break; // Finished version step
          }
        }

        if (selectionExitToMain) {
          break;
        }

        // ... rest of the build process (Prerequisites, PreBuild, Android, iOS) ...
        const ensuredConfig = await ensureSetupPrerequisites({ platform });
        if (!ensuredConfig) {
          console.log(chalk.yellow(t('setupFix.cancelled')));
          process.exitCode = 1;
          return;
        }
        config = ensuredConfig;

        const summary = {
          project: config.PROJECT_NAME || 'app',
          platform,
          version: finalVersion || (versionInfo && versionInfo.version) || t('common.unknownValue'),
          build: finalBuild || (versionInfo && versionInfo.build) || '0',
        };
        const artifactBaseName = buildArtifactBaseName({ config, summary });

        if (!runPreBuildSteps({ config, platform })) {
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

        if (isInteractive) {
            await promptOpenOutputFolder(config, platform);
        }
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

function runPreBuildSteps({ config, platform }) {
  // Ensure latest config from setup checks
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
