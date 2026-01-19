#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { select, confirm } = require('@inquirer/prompts');
const pkg = require('./package.json');
const setup = require('./src/commands/setup/index.js');
const doctor = require('./src/commands/doctor/index.js');
const lang = require('./src/commands/lang/index.js');
const build = require('./src/commands/build/index.js');
const deploy = require('./src/commands/deploy/index.js');
const buildDeploy = require('./src/commands/build-deploy/index.js');
const buildClean = require('./src/commands/build-clean/index.js');
const initCi = require('./src/commands/init-ci/index.js');
const { initI18n, t } = require('./src/i18n');
const { registerExitPrompt, handlePromptExit } = require('./src/utils/exitPrompt');
const baseTheme = require('./src/utils/selectTheme');

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
registerExitPrompt();

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
deploy(program);
buildDeploy(program);
buildClean(program);
initCi(program);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const noCommandProvided = process.argv.length <= 2;

  if (noCommandProvided && process.stdin.isTTY) {
    global.__APPSHIP_FROM_MAIN = true;
    while (true) {
      try {
        const choice = await select({
          message: t('mainMenu.prompt'),
          choices: [
            { value: 'setup', name: t('mainMenu.setup') },
            { value: 'build', name: t('mainMenu.build') },
            { value: 'deploy', name: t('mainMenu.deploy') },
            { value: 'build-deploy', name: t('mainMenu.buildDeploy') },
            { value: 'build-clean', name: t('mainMenu.buildClean') },
            { value: 'init-ci', name: t('mainMenu.initCi') },
            { value: 'lang', name: t('mainMenu.lang') },
            { value: 'exit', name: t('mainMenu.exit') },
          ],
          pageSize: 10,
          theme: baseTheme,
        });

        if (choice === 'exit') {
          const shouldExit = await confirm({
            message: t('common.exitPrompt'),
            default: true,
          });
          if (shouldExit) {
            return;
          }
          continue;
        }

        const argv = [process.argv[0], process.argv[1], choice];
        await program.parseAsync(argv);
        // komut bittiyse yeniden ana menüye dön
        continue;
      } catch (error) {
        const handled = await handlePromptExit(error);
        if (handled === 'resume') {
          continue;
        }
        if (!handled) {
          throw error;
        }
        continue;
      }
    }
  }

  global.__APPSHIP_FROM_MAIN = false;

  if (noCommandProvided && !process.stdin.isTTY) {
    program.outputHelp();
    process.exitCode = 1;
    return;
  }

  program.parse(process.argv);
}
