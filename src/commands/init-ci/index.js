const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { select } = require('@inquirer/prompts');
const { t } = require('../../i18n');
const { githubActionTemplate, gitlabCiTemplate } = require('./templates');
const { selectWithBack } = require('../../utils/navigation');

function registerInitCiCommand(program) {
  const initCi = program.command('init-ci').description(t('initCi.description'));

  initCi.action(async () => {
    try {
        if (!process.stdin.isTTY) {
            console.log(chalk.red(t('initCi.error.nonInteractive')));
            process.exitCode = 1;
            return;
        }

        const provider = await selectWithBack({
            allowBack: true,
            message: t('initCi.providerPrompt'),
            choices: [
                { value: 'github', name: t('initCi.providers.github') },
                { value: 'gitlab', name: t('initCi.providers.gitlab') },
            ],
        });

        if (!provider) return;

        const platform = await selectWithBack({
            allowBack: true,
            message: t('initCi.platformPrompt'),
            choices: [
                { value: 'android', name: t('initCi.platforms.android') },
                { value: 'ios', name: t('initCi.platforms.ios') },
                { value: 'both', name: t('initCi.platforms.both') },
            ],
        });

        if (!platform) return;

        let content = '';
        let filename = '';

        if (provider === 'github') {
            content = githubActionTemplate({ platform });
            const dir = path.join(process.cwd(), '.github', 'workflows');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            filename = path.join(dir, 'appship.yml');
        } else {
            content = gitlabCiTemplate({ platform });
            filename = path.join(process.cwd(), '.gitlab-ci.yml');
        }

        if (fs.existsSync(filename)) {
            console.log(chalk.yellow(t('initCi.exists', { filename })));
            return;
        }

        fs.writeFileSync(filename, content, 'utf8');
        console.log(chalk.green(t('initCi.success', { filename })));
        console.log(chalk.blue(t('initCi.note')));

    } catch (error) {
        console.log(chalk.red(error.message));
        process.exitCode = 1;
    }
  });
}

module.exports = registerInitCiCommand;
