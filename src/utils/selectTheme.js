const chalk = require('chalk');

// Daha okunaklı ve renkli bir prompt teması
const baseTheme = {
  prefix: { idle: chalk.dim('❯'), done: chalk.green('✔') },
  indexMode: 'number', // 1., 2., 3. gösterilir; istenirse 'hidden'
  style: {
    keysHelpTip: () => undefined, // alt yardım satırını gizle
    message: (txt) => chalk.cyan.bold(txt),
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
