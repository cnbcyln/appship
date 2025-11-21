const chalk = require('chalk');
const { selectWithBack } = require('../../utils/navigation');
const { readConfig, updateConfig, ensureConfigFile } = require('../../utils/config');
const { t, setLocale } = require('../../i18n');
const { handlePromptExit } = require('../../utils/exitPrompt');

const AVAILABLE_LANGUAGES = [
  { value: 'en', labelKey: 'lang.info.languages.en' },
  { value: 'tr', labelKey: 'lang.info.languages.tr' },
];

function registerLangCommand(program) {
  program
    .command('lang')
    .description(t('lang.info.description'))
    .action(async () => {
      while (true) {
        try {
        ensureConfigFile();

        if (!process.stdin.isTTY) {
          console.log(chalk.red(t('lang.error.nonInteractive')));
          process.exitCode = 1;
          return;
        }

        const current = readConfig().LANGUAGE || 'en';
        const choices = AVAILABLE_LANGUAGES.map((item) => ({
          name: t(item.labelKey),
          value: item.value,
        }));

        const language = await selectWithBack({
          allowBack: global.__APPSHIP_FROM_MAIN === true,
          message: t('lang.info.prompt'),
          choices,
          loop: false,
          default: current,
        });
        if (!language) {
          continue;
        }

        if (language === current) {
          console.log(chalk.yellow(t('lang.warning.noChange', { language: t(getLabelKey(language)) })));
          return;
        }

        updateConfig({ LANGUAGE: language });
        setLocale(language);
        console.log(chalk.green(t('lang.success.updated', { language: t(getLabelKey(language)) })));
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
}

function getLabelKey(code) {
  const entry = AVAILABLE_LANGUAGES.find((item) => item.value === code);
  return entry ? entry.labelKey : 'lang.info.languages.en';
}

module.exports = registerLangCommand;
