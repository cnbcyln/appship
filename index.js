#!/usr/bin/env node

const { Command } = require('commander');
const pkg = require('./package.json');
const setup = require('./src/commands/setup/index.js');
const doctor = require('./src/commands/doctor/index.js');
const lang = require('./src/commands/lang/index.js');
const { initI18n } = require('./src/i18n');

const program = new Command();

program
  .name('appship')
  .description('AppShip CLI - mobile build & deploy otomasyon aracı')
  .version(pkg.version);

initI18n();
setup(program);
doctor(program);
lang(program);

program.parse(process.argv);
