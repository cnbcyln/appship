const os = require('os');
const chalk = require('chalk');
const { confirm } = require('@inquirer/prompts');
const { runCommand, commandExists, readVersion } = require('../../utils/process');
const { t } = require('../../i18n');

async function runFlutterDoctor() {
  console.log(chalk.cyan.bold(t('doctor.flutter.info.title')));
  let justInstalled = false;

  if (!commandExists('flutter')) {
    console.log(chalk.red(t('doctor.error.flutter.notInstalled')));
    const installed = attemptFlutterInstall();
    if (!installed) {
      adviseManualFlutterInstall();
      return false;
    }
    justInstalled = true;
  }

  const version = readVersion('flutter', ['--version']);
  if (version) {
    console.log(chalk.gray(t('doctor.flutter.info.version', { value: formatFlutterVersion(version) })));
  }

  if (justInstalled) {
    console.log(chalk.green(t('doctor.success.flutter.newInstallSkip')));
  } else {
    const updateStatus = checkFlutterUpdateStatus();

    if (updateStatus.status === 'up_to_date') {
      console.log(chalk.green(t('doctor.success.flutter.upToDate')));
    } else if (updateStatus.status === 'needs_update') {
      console.log(chalk.yellow(t('doctor.warning.flutter.updateAvailable')));
      if (updateStatus.latestVersion) {
        console.log(
          chalk.blue(
            t('doctor.flutter.info.latestVersion', {
              value: formatLatestAvailableFlutterVersion(updateStatus.latestVersion),
            })
          )
        );
      }
      const wantsUpdate = await confirm({
        message: t('doctor.warning.flutter.updatePrompt'),
        default: false,
      });
      if (!wantsUpdate) {
        console.log(chalk.yellow(t('doctor.warning.flutter.updateSkipped')));
      } else if (!updateFlutter()) {
        return false;
      }
    } else {
      console.log(chalk.yellow(t('doctor.warning.flutter.updateStatusUnknown')));
    }
  }

  return verifyFlutterDoctor();
}

function updateFlutter() {
  console.log(chalk.blue(t('doctor.flutter.info.updateCheck')));
  const result = runCommand('flutter', ['upgrade'], { inherit: true });
  if (result.success) {
    console.log(chalk.green(t('doctor.success.flutter.upToDate')));
    return true;
  }

  console.log(chalk.red(t('doctor.error.flutter.updateFailure')));
  return false;
}

function attemptFlutterInstall() {
  if (os.platform() === 'darwin' && commandExists('brew')) {
    console.log(chalk.blue(t('doctor.flutter.info.installBrew')));
    const result = runCommand('brew', ['install', '--cask', 'flutter'], { inherit: true });
    if (result.success) {
      console.log(chalk.green(t('doctor.success.flutter.installSuccess')));
      return true;
    }

    console.log(chalk.red(t('doctor.error.flutter.installFailure')));
  }

  return false;
}

function adviseManualFlutterInstall() {
  console.log(chalk.yellow(t('doctor.flutter.info.manual.title')));
  if (os.platform() === 'darwin') {
    console.log(t('doctor.flutter.info.manual.macos'));
  } else if (os.platform() === 'linux') {
    console.log(t('doctor.flutter.info.manual.linuxSnap'));
    console.log(t('doctor.flutter.info.manual.linuxAlt'));
  } else if (os.platform() === 'win32') {
    console.log(t('doctor.flutter.info.manual.windows'));
  } else {
    console.log(t('doctor.flutter.info.manual.generic'));
  }
}

function verifyFlutterDoctor() {
  console.log(chalk.blue(t('doctor.flutter.info.doctorRun')));
  const result = runCommand('flutter', ['doctor']);

  if (!result.success) {
    console.log(
      chalk.red(t('doctor.error.flutter.doctorFailure', { message: result.stderr || t('common.unknownError') }))
    );
    return false;
  }

  if (result.stdout) {
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.log(result.stderr);
  }

  const normalizedOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();
  const hasIssues = normalizedOutput.includes('[✗') || normalizedOutput.includes('[x') || normalizedOutput.includes('[!]');
  const noIssuesMessage = normalizedOutput.includes('no issues found');

  if (!hasIssues && noIssuesMessage) {
    console.log(chalk.green(t('doctor.success.flutter.doctorSuccess')));
    return true;
  }

  console.log(chalk.red(t('doctor.error.flutter.doctorIssues')));
  return false;
}

function checkFlutterUpdateStatus() {
  const result = runCommand('flutter', ['upgrade', '--verify-only']);

  if (!result.success) {
    console.log(
      chalk.yellow(
        t('doctor.warning.flutter.verifyFailure', { message: result.stderr || t('common.unknownError') })
      )
    );
    return { status: 'unknown' };
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const sanitizedOutput = stripAnsiSequences(combinedOutput);
  const normalizedOutput = sanitizedOutput.toLowerCase();

  if (normalizedOutput.includes('already up to date') || normalizedOutput.includes('already up-to-date')) {
    return { status: 'up_to_date' };
  }

  if (
    normalizedOutput.includes('new version of flutter') ||
    normalizedOutput.includes('a newer version of flutter') ||
    normalizedOutput.includes('upgrading flutter')
  ) {
    return {
      status: 'needs_update',
      latestVersion: extractLatestFlutterVersion(sanitizedOutput),
    };
  }

  return { status: 'unknown' };
}

function formatFlutterVersion(raw) {
  if (!raw) {
    return t('common.unknownValue');
  }

  const parts = raw.split('•').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return raw.trim();
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const versionPart = parts[0];
  const channelPart = parts[1] && !parts[1].startsWith('https') ? parts[1] : null;

  if (versionPart && channelPart) {
    return `${versionPart} (${channelPart})`;
  }

  return versionPart || channelPart || raw.trim();
}

function formatLatestAvailableFlutterVersion(info) {
  if (!info) {
    return t('common.unknownValue');
  }

  if (!info.version) {
    return info.channel || info.revision ? [info.channel, info.revision].filter(Boolean).join(', ') : t('common.unknownValue');
  }

  if (info.channel) {
    return info.revision ? `${info.version} (${info.channel}, ${info.revision})` : `${info.version} (${info.channel})`;
  }

  if (info.revision) {
    return `${info.version} (${info.revision})`;
  }

  return info.version;
}

function extractLatestFlutterVersion(output) {
  if (!output) {
    return null;
  }

  const channelMatch = output.match(/A new version of Flutter is available on channel\s+([A-Za-z0-9_\-]+)/i);

  const latestLineMatch = output.match(
    /The latest version:\s*([0-9][0-9A-Za-z\.\+\-]*)[^\n]*?(?:\(revision\s+([A-Za-z0-9]+)\))?/i
  );
  if (latestLineMatch) {
    return {
      version: latestLineMatch[1],
      revision: latestLineMatch[2] || null,
      channel: channelMatch ? channelMatch[1] : null,
    };
  }

  const upgradingLineMatch = output.match(
    /Upgrading Flutter to\s+([0-9][0-9A-Za-z\.\+\-]*)[^\n]*?(?:in\s+channel\s+([A-Za-z0-9_\-]+))?/i
  );
  if (upgradingLineMatch) {
    return {
      version: upgradingLineMatch[1],
      revision: null,
      channel: upgradingLineMatch[2] || channelMatch || null,
    };
  }

  const updateLineMatch = output.match(/To update to Flutter\s+([0-9][0-9A-Za-z\.\+\-]*)/i);
  if (updateLineMatch) {
    return {
      version: updateLineMatch[1],
      revision: null,
      channel: channelMatch || null,
    };
  }

  return channelMatch ? { version: null, revision: null, channel: channelMatch[1] } : null;
}

function stripAnsiSequences(value) {
  if (!value) {
    return '';
  }

  // Removes common ANSI color/control sequences that might be emitted by Flutter.
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

module.exports = {
  runFlutterDoctor,
};
