function setupCommand(program) {
  program
    .command('setup')
    .description('Kurulum işlemlerini başlatır')
    .option('-f, --full', 'Full kurulum işlemini başlatır')
    .action((options) => {
      console.log(options);
    });

  return program;
}

module.exports = setupCommand;