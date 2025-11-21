const chalk = require('chalk');
const { t } = require('../i18n');

// Daha okunaklı ve renkli bir prompt teması
const baseTheme = {
  prefix: { idle: chalk.dim('❯'), done: chalk.green('✔') },
  indexMode: 'number', // 1., 2., 3. gösterilir; istenirse 'hidden'
  style: {
    keysHelpTip: (keys) => {
      if (!keys || !keys.length) return undefined;
      
      keys.push(['q', t('common.quit')]);

      var index = keys.findIndex(([k, action]) => k === '↑↓');
      if (index !== -1) {
        keys[index] = ['↑↓', t('common.navigate')];
      }

      index = keys.findIndex(([k, action]) => k === '⏎');
      if (index !== -1) {
        keys[index] = ['↵', t('common.select')];
      }

      const label = keys
        .map(([k, action]) => `${chalk.yellow(k)} ${chalk.dim(action)}`)
        .join(chalk.dim('  •  '));
      
      return chalk.gray(label);
    },
    message: (txt) => chalk.blue.bold(txt),
    answer: (txt) => chalk.green(txt),
    error: (txt) => chalk.red(txt),
    help: (txt) => chalk.dim(txt),
    highlight: (txt) => chalk.yellow(txt),
    description: (txt) => chalk.gray(txt),
    disabled: (txt) => chalk.gray.strikethrough(txt),
  },
  icon: { cursor: chalk.cyan('▶') },
  spinner: { interval: 70, frames: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'] },
};

module.exports = baseTheme;
