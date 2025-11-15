const readline = require('readline');
const colors = require('colors/safe');

const YES_VALUES = ['e', 'evet', 'y', 'yes'];
const NO_VALUES = ['h', 'hayir', 'hayır', 'n', 'no'];

/**
 * Basit bir evet/hayır doğrulama akışı.
 * @param {string} question - Kullanıcıya gösterilecek soru.
 * @param {object} [options]
 * @param {boolean} [options.defaultValue=false] - Kullanıcı yanıt vermezse döndürülecek değer.
 * @param {boolean} [options.printNonTtyNotice=true] - TTY olmayan ortamlarda bilgi mesajı yazılsın mı?
 * @returns {Promise<boolean>}
 */
function confirm(question, options = {}) {
  const { defaultValue = false, printNonTtyNotice = true } = options;
  const suffix = defaultValue ? ' (E/h)' : ' (e/H)';

  if (!process.stdin.isTTY) {
    if (printNonTtyNotice) {
      console.log(
        colors.yellow(`${question} - interaktif olmayan ortamda varsayılan: ${defaultValue ? 'evet' : 'hayır'}`)
      );
    }
    return Promise.resolve(defaultValue);
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(colors.yellow(`${question}${suffix}: `), (answer = '') => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (!normalized) {
        resolve(defaultValue);
        return;
      }

      if (YES_VALUES.includes(normalized)) {
        resolve(true);
        return;
      }

      if (NO_VALUES.includes(normalized)) {
        resolve(false);
        return;
      }

      resolve(defaultValue);
    });
  });
}

module.exports = {
  confirm,
};
