#!/usr/bin/env node

const { Command } = require('commander');
const pkg = require('./package.json');
const setup = require('./src/commands/setup/index.js');

const program = new Command();

program
  .name('appship')
  .description('AppShip CLI - mobile build & deploy otomasyon aracı')
  .version(pkg.version);

setup(program);

program.parse(process.argv);