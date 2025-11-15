const { spawnSync } = require('child_process');

function runCommand(command, args = [], options = {}) {
  const spawnOptions = {
    stdio: options.inherit ? 'inherit' : 'pipe',
    shell: options.shell || false,
    env: options.env || process.env,
  };

  const result = spawnSync(command, args, spawnOptions);

  if (result.error) {
    return { success: false, stdout: '', stderr: result.error.message };
  }

  return {
    success: result.status === 0,
    stdout: result.stdout ? result.stdout.toString().trim() : '',
    stderr: result.stderr ? result.stderr.toString().trim() : '',
  };
}

function commandExists(command) {
  const checkCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = runCommand(checkCommand, [command]);
  return result.success && Boolean(result.stdout);
}

function getCommandPath(command) {
  const checkCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = runCommand(checkCommand, [command]);
  if (!result.success || !result.stdout) {
    return null;
  }

  return result.stdout.split(/\r?\n/)[0].trim();
}

function readVersion(command, args) {
  const result = runCommand(command, args);
  if (!result.success || !result.stdout) {
    return null;
  }

  const trimmedOutput = result.stdout.trim();
  if (!trimmedOutput) {
    return null;
  }

  const lines = trimmedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return trimmedOutput;
  }

  if (lines[0].toLowerCase().includes('installation at path') && lines.length > 1) {
    return `${lines[0]} ${lines[1]}`;
  }

  return lines[0];
}

module.exports = {
  runCommand,
  commandExists,
  getCommandPath,
  readVersion,
};
