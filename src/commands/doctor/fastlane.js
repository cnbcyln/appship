const os = require('os');
const chalk = require('chalk');
const { confirm } = require('@inquirer/prompts');
const { runCommand, commandExists, getCommandPath, readVersion } = require('../../utils/process');
const { t } = require('../../i18n');

async function runFastlaneDoctor() {
  console.log(chalk.cyan.bold(`\n${t('doctor.fastlane.info.title')}`));
  let justInstalled = false;

  if (!commandExists('fastlane')) {
    console.log(chalk.red(t('doctor.error.fastlane.notInstalled')));
    const installed = attemptFastlaneInstall();
    if (!installed) {
      adviseManualFastlaneInstall();
      return false;
    }
    justInstalled = true;
  }

  const fastlaneVersionRaw = readVersion('fastlane', ['--version']);
  if (fastlaneVersionRaw) {
    const parsedVersion = extractFastlaneVersion(fastlaneVersionRaw) || t('common.unknownValue');
    console.log(chalk.gray(t('doctor.fastlane.info.version', { value: parsedVersion })));
  }

  if (justInstalled) {
    console.log(chalk.green(t('doctor.success.fastlane.newInstallSkip')));
    return true;
  }

  const updateStatus = checkFastlaneUpdateStatus();

  if (updateStatus.status === 'up_to_date') {
    console.log(chalk.green(t('doctor.success.fastlane.upToDate')));
    return true;
  }

  if (updateStatus.status === 'needs_update') {
    const message = updateStatus.messageKey ? t(updateStatus.messageKey) : t('doctor.warning.fastlane.updateAvailable');
    console.log(chalk.yellow(message));
    const question = updateStatus.command
      ? t('doctor.fastlane.info.updatePromptCommand', { command: updateStatus.command })
      : t('doctor.fastlane.info.updatePrompt');
    const wantsUpdate = await confirm(question, { defaultValue: false });
    if (!wantsUpdate) {
      console.log(chalk.yellow(t('doctor.warning.fastlane.updateSkipped')));
      return true;
    }

    return updateFastlane();
  }

  console.log(chalk.yellow(t('doctor.warning.fastlane.updateStatusUnknown')));
  return true;
}

function updateFastlane() {
  const fastlanePath = getCommandPath('fastlane');
  const usingBrew = fastlanePath && fastlanePath.toLowerCase().includes('homebrew') && commandExists('brew');

  if (usingBrew) {
    console.log(chalk.blue(t('doctor.fastlane.info.updateBrew')));
    const brewUpgrade = runCommand('brew', ['upgrade', 'fastlane'], { inherit: true });
    if (brewUpgrade.success) {
      console.log(chalk.green(t('doctor.success.fastlane.upToDate')));
      return true;
    }
    console.log(chalk.yellow(t('doctor.warning.fastlane.updateFallback')));
  }

  console.log(chalk.blue(t('doctor.fastlane.info.updateFastlane')));
  const result = runCommand('fastlane', ['update_fastlane'], { inherit: true });
  if (result.success) {
    console.log(chalk.green(t('doctor.success.fastlane.upToDate')));
    return true;
  }

  console.log(chalk.red(t('doctor.error.fastlane.updateFailure')));
  return false;
}

function attemptFastlaneInstall() {
  if (commandExists('brew')) {
    console.log(chalk.blue(t('doctor.fastlane.info.installBrew')));
    const result = runCommand('brew', ['install', 'fastlane'], { inherit: true });
    if (result.success) {
      console.log(chalk.green(t('doctor.success.fastlane.installSuccess')));
      return true;
    }

    console.log(chalk.red(t('doctor.error.fastlane.installFailureBrew')));
  }

  if (commandExists('gem')) {
    console.log(chalk.blue(t('doctor.fastlane.info.installGem')));
    const result = runCommand('gem', ['install', 'fastlane', '-NV'], { inherit: true });
    if (result.success) {
      console.log(chalk.green(t('doctor.success.fastlane.installSuccess')));
      return true;
    }

    console.log(chalk.red(t('doctor.error.fastlane.installFailureGem')));
  }

  console.log(
    chalk.yellow(t('doctor.warning.fastlane.installMissingManager'))
  );

  return false;
}

function adviseManualFastlaneInstall() {
  console.log(chalk.yellow(t('doctor.fastlane.info.manual.title')));
  if (os.platform() === 'darwin') {
    console.log(t('doctor.fastlane.info.manual.macos'));
  } else if (os.platform() === 'linux') {
    console.log(t('doctor.fastlane.info.manual.linux'));
  } else if (os.platform() === 'win32') {
    console.log(t('doctor.fastlane.info.manual.windows'));
  } else {
    console.log(t('doctor.fastlane.info.manual.generic'));
  }
}

function checkFastlaneUpdateStatus() {
  const hasBrew = commandExists('brew');
  const hasGem = commandExists('gem');

  if (hasBrew) {
    const brewResult = runCommand('brew', ['outdated', 'fastlane', '--quiet']);
    if (brewResult.success) {
      const trimmed = brewResult.stdout.trim();
      if (!trimmed) {
        return { status: 'up_to_date' };
      }

      if (trimmed.split(/\r?\n/).some((line) => line.trim() === 'fastlane')) {
        return {
          status: 'needs_update',
          messageKey: 'doctor.warning.fastlane.updateStatusBrew',
          command: 'brew upgrade fastlane',
        };
      }
    }
  }

  if (hasGem) {
    const gemResult = runCommand('gem', ['outdated', 'fastlane']);
    if (gemResult.success) {
      const trimmed = gemResult.stdout.trim();
      if (!trimmed) {
        return { status: 'up_to_date' };
      }

      if (trimmed.includes('fastlane')) {
        return {
          status: 'needs_update',
          messageKey: 'doctor.warning.fastlane.updateStatusGem',
          command: 'gem update fastlane',
        };
      }
    }
  }

  if (!hasBrew && !hasGem) {
    console.log(chalk.yellow(t('doctor.warning.fastlane.updateStatusNoManager')));
  }

  return { status: 'unknown' };
}

function extractFastlaneVersion(output) {
  if (!output) {
    return null;
  }

  const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    return versionMatch[1];
  }

  const firstLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine || null;
}

module.exports = {
  runFastlaneDoctor,
};
