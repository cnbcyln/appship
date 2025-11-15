const readline = require('readline');
const colors = require('colors/safe');

function promptInput(question, options = {}) {
  const { defaultValue = '' } = options;

  if (!process.stdin.isTTY) {
    if (defaultValue) {
      console.log(colors.yellow(`${question} - interaktif olmayan ortamda varsayılan değer kullanılacak: ${defaultValue}`));
    } else {
      console.log(colors.yellow(`${question} - interaktif olmayan ortam, boş değer döndürülüyor.`));
    }
    return Promise.resolve(defaultValue);
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const suffix = defaultValue ? ` (${defaultValue})` : '';
    rl.question(colors.cyan(`${question}${suffix ? ` [${defaultValue}]` : ''}: `), (answer) => {
      rl.close();
      const normalized = answer.trim();
      if (!normalized && defaultValue) {
        resolve(defaultValue);
      } else {
        resolve(normalized);
      }
    });
  });
}

module.exports = {
  promptInput,
};
