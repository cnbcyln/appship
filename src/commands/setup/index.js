function setupCommand(program) {
  program
    .command('setup')
    .description('Kurulum işlemlerini başlatır')
    .option('-f, --full', 'Full kurulum işlemini başlatır')
    .option('--flutter', 'Flutter kontrolü yapar. Yüklü değilse yükler.')
    .option('--fastlane', 'Fastlane kontrolü yapar. Yüklü değilse yükler.')
    .action((options) => {
      
    });

  return program;
}

module.exports = setupCommand;