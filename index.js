#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const pkg = require('./package.json');
const setup = require('./src/commands/setup/index.js');
const doctor = require('./src/commands/doctor/index.js');
const lang = require('./src/commands/lang/index.js');
const build = require('./src/commands/build/index.js');
const { initI18n, t } = require('./src/i18n');

const program = new Command();
let lastErrorOutput = '';

program
  .name('appship')
  .description('AppShip CLI - mobile build & deploy otomasyon aracı')
  .version(pkg.version);

program.configureOutput({
  outputError: (str) => {
    lastErrorOutput = str;
  },
});

initI18n();

program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed') {
    process.exitCode = 0;
    return;
  }

  if (err.code === 'commander.excessArguments') {
    const parsed = parseExcessArguments(err.message);
    const commandName =
      (err.command && typeof err.command.name === 'function' && err.command.name()) ||
      parsed.command ||
      'command';
    const expected = parsed.expected ?? err.expected ?? 0;
    const received = parsed.received ?? err.received ?? 0;
    console.log(chalk.red(t('common.errors.excessArguments', { command: commandName, expected, received })));
    lastErrorOutput = '';
    process.exitCode = 1;
    return;
  }

  if (lastErrorOutput) {
    console.error(lastErrorOutput.trimEnd());
    lastErrorOutput = '';
  }
  throw err;
});

function parseExcessArguments(message) {
  if (!message) {
    return {};
  }

  const commandMatch = message.match(/'([^']+)'/);
  const numbersMatch = message.match(/Expected\s+(\d+)[^\d]+(\d+)/i);

  return {
    command: commandMatch ? commandMatch[1] : undefined,
    expected: numbersMatch ? Number(numbersMatch[1]) : undefined,
    received: numbersMatch ? Number(numbersMatch[2]) : undefined,
  };
}
setup(program);
doctor(program);
lang(program);
build(program);

program.parse(process.argv);
