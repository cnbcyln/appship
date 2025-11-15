const os = require('os');
const colors = require('colors/safe');
const { confirm } = require('../../utils/confirm');
const {
  runCommand,
  commandExists,
  getCommandPath,
  readVersion,
} = require('../../utils/process');

function doctorCommand(program) {
  program
    .command('doctor')
    .description('AppShip CLI için gerekli olan paketleri kontrol eder')
    .action(async () => {
      try {
        console.log(colors.cyan.bold('🔎 AppShip Doctor başladı\n'));

        const flutterReady = await ensureFlutter();
        const fastlaneReady = await ensureFastlane();

        if (flutterReady && fastlaneReady) {
          console.log(colors.green.bold('\n✅ Tüm bağımlılıklar hazır.'));
        } else {
          console.log(colors.yellow.bold('\n⚠️  Bazı bağımlılıklar eksik veya güncellenemedi. Yukarıdaki yönlendirmeleri takip edin.'));
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(colors.red(`\n💥 Beklenmeyen hata: ${error.message}`));
        process.exitCode = 1;
      }
    });

  return program;
}

async function ensureFlutter() {
  console.log(colors.cyan.bold('==> Flutter'));
  let justInstalled = false;

  if (!commandExists('flutter')) {
    console.log(colors.red('❌ Flutter yüklü değil.'));
    const installed = attemptFlutterInstall();
    if (!installed) {
      adviseManualFlutterInstall();
      return false;
    }
    justInstalled = true;
  }

  const version = readVersion('flutter', ['--version']);
  if (version) {
    console.log(colors.gray(`📦 Sürüm: ${version}`));
  }

  if (justInstalled) {
    console.log(colors.green('✨ Flutter yeni yüklendi, güncelleme adımı atlandı.'));
  } else {
    const updateStatus = checkFlutterUpdateStatus();

    if (updateStatus.status === 'up_to_date') {
      console.log(colors.green('✅ Flutter güncel.'));
    } else if (updateStatus.status === 'needs_update') {
      console.log(colors.yellow(updateStatus.message || '⚠️  Flutter için yeni bir sürüm mevcut.'));
      const wantsUpdate = await confirm('Flutter için güncelleme yapmak ister misiniz?', { defaultValue: false });
      if (!wantsUpdate) {
        console.log(colors.yellow('⏭ Flutter güncellemesi kullanıcı tarafından atlandı.'));
      } else {
        const updated = updateFlutter();
        if (!updated) {
          return false;
        }
      }
    } else {
      console.log(colors.yellow('⚠️  Flutter güncelleme durumu tespit edilemedi. Manuel olarak `flutter upgrade --verify-only` çalıştırabilirsiniz.'));
    }
  }

  return verifyFlutterDoctor();
}

async function ensureFastlane() {
  console.log(colors.cyan.bold('\n==> Fastlane'));
  let justInstalled = false;

  if (!commandExists('fastlane')) {
    console.log(colors.red('❌ Fastlane yüklü değil.'));
    const installed = attemptFastlaneInstall();
    if (!installed) {
      adviseManualFastlaneInstall();
      return false;
    }
    justInstalled = true;
  }

  const fastlaneVersionRaw = readVersion('fastlane', ['--version']);
  if (fastlaneVersionRaw) {
    const fastlaneVersion = extractFastlaneVersion(fastlaneVersionRaw);
    console.log(colors.gray(`📦 Sürüm: ${fastlaneVersion}`));
  }

  if (justInstalled) {
    console.log(colors.green('✨ Fastlane yeni yüklendi, güncelleme adımı atlandı.'));
    return true;
  }

  const updateStatus = checkFastlaneUpdateStatus();

  if (updateStatus.status === 'up_to_date') {
    console.log(colors.green('✅ Fastlane güncel.'));
    return true;
  }

  if (updateStatus.status === 'needs_update') {
    console.log(colors.yellow(updateStatus.message || '⚠️  Fastlane için yeni bir sürüm mevcut.'));
    const wantsUpdate = await confirm('Fastlane için güncelleme yapmak ister misiniz?', { defaultValue: false });
    if (!wantsUpdate) {
      console.log(colors.yellow('⏭ Fastlane güncellemesi kullanıcı tarafından atlandı.'));
      return false;
    }

    return updateFastlane();
  }

  console.log(colors.yellow('⚠️  Fastlane güncelleme durumu tespit edilemedi. Manuel olarak `fastlane update_fastlane` veya paket yöneticinizin komutlarını çalıştırın.'));
  return true;
}

function updateFlutter() {
  console.log(colors.blue('🔄 Flutter güncellemesi kontrol ediliyor (flutter upgrade)...'));
  const result = runCommand('flutter', ['upgrade'], { inherit: true });
  if (result.success) {
    console.log(colors.green('✅ Flutter güncel.'));
    return true;
  }

  console.error(colors.red('❌ Flutter güncellemesi başarısız oldu. Manuel olarak `flutter upgrade` komutunu çalıştırın.'));
  return false;
}

function updateFastlane() {
  const fastlanePath = getCommandPath('fastlane');
  const usingBrew = fastlanePath && fastlanePath.toLowerCase().includes('homebrew') && commandExists('brew');

  if (usingBrew) {
    console.log(colors.blue('🔄 Fastlane Homebrew üzerinden güncelleniyor (brew upgrade fastlane)...'));
    const brewUpgrade = runCommand('brew', ['upgrade', 'fastlane'], { inherit: true });
    if (brewUpgrade.success) {
      console.log(colors.green('✅ Fastlane güncel.'));
      return true;
    }
    console.warn(colors.yellow('⚠️  Homebrew güncellemesi başarısız oldu, fastlane update_fastlane denenecek.'));
  }

  console.log(colors.blue('🔄 Fastlane güncellemesi kontrol ediliyor (fastlane update_fastlane)...'));
  const result = runCommand('fastlane', ['update_fastlane'], { inherit: true });
  if (result.success) {
    console.log(colors.green('✅ Fastlane güncel.'));
    return true;
  }

  console.error(colors.red('❌ Fastlane güncellemesi başarısız oldu. Manuel olarak `brew upgrade fastlane` veya `gem update fastlane` komutunu çalıştırın.'));
  return false;
}

function attemptFlutterInstall() {
  if (os.platform() === 'darwin' && commandExists('brew')) {
    console.log(colors.blue('➡️  Homebrew ile Flutter kurulumu başlatılıyor (brew install --cask flutter)...'));
    const result = runCommand('brew', ['install', '--cask', 'flutter'], { inherit: true });
    if (result.success) {
      console.log(colors.green('✅ Flutter başarıyla kuruldu.'));
      return true;
    }

    console.error(colors.red('❌ Homebrew Flutter kurulumu başarısız oldu.'));
  }

  return false;
}

function attemptFastlaneInstall() {
  if (commandExists('brew')) {
    console.log(colors.blue('➡️  Homebrew ile Fastlane kurulumu başlatılıyor (brew install fastlane)...'));
    const result = runCommand('brew', ['install', 'fastlane'], { inherit: true });
    if (result.success) {
      console.log(colors.green('✅ Fastlane başarıyla kuruldu.'));
      return true;
    }

    console.error(colors.red('❌ Homebrew Fastlane kurulumu başarısız oldu.'));
  }

  if (commandExists('gem')) {
    console.log(colors.blue('➡️  RubyGems ile Fastlane kurulumu başlatılıyor (gem install fastlane -NV)...'));
    const result = runCommand('gem', ['install', 'fastlane', '-NV'], { inherit: true });
    if (result.success) {
      console.log(colors.green('✅ Fastlane başarıyla kuruldu.'));
      return true;
    }

    console.error(colors.red('❌ RubyGems Fastlane kurulumu başarısız oldu.'));
  }

  console.warn(
    colors.yellow('⚠️  Fastlane kurulumu için Homebrew veya RubyGems bulunamadı. Lütfen uygun paket yöneticisini kurun.')
  );

  return false;
}

function adviseManualFlutterInstall() {
  console.log(colors.yellow('ℹ️  Flutter kurulum adımları:'));
  if (os.platform() === 'darwin') {
    console.log('  • Homebrew dışı kurulum için: https://docs.flutter.dev/get-started/install/macos');
  } else if (os.platform() === 'linux') {
    console.log('  • Snap ile kurulum: sudo snap install flutter --classic');
    console.log('  • Alternatif: https://docs.flutter.dev/get-started/install/linux');
  } else if (os.platform() === 'win32') {
    console.log('  • Chocolatey ile kurulum: choco install flutter');
  } else {
    console.log('  • Platform dokümantasyonu: https://docs.flutter.dev/get-started/install');
  }
}

function adviseManualFastlaneInstall() {
  console.log(colors.yellow('ℹ️  Fastlane kurulum adımları:'));
  if (os.platform() === 'darwin') {
    console.log('  • RubyGems ile kurulum: sudo gem install fastlane -NV');
  } else if (os.platform() === 'linux') {
    console.log('  • RubyGems ile kurulum: sudo gem install fastlane -NV');
  } else if (os.platform() === 'win32') {
    console.log('  • Scoop veya Chocolatey: choco install fastlane');
  } else {
    console.log('  • Genel talimat: https://docs.fastlane.tools');
  }
}

function verifyFlutterDoctor() {
  console.log(colors.blue('🩺 Flutter Doctor kontrol ediliyor...'));
  const result = runCommand('flutter', ['doctor']);

  if (!result.success) {
    console.error(
      colors.red(`❌ Flutter Doctor çalıştırılırken hata oluştu: ${result.stderr || 'bilinmeyen hata'}. Manuel kontrol edin.`)
    );
    return false;
  }

  if (result.stdout) {
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.error(result.stderr);
  }

  const normalizedOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();
  const hasIssues = normalizedOutput.includes('[✗') || normalizedOutput.includes('[x') || normalizedOutput.includes('[!]');
  const noIssuesMessage = normalizedOutput.includes('no issues found');

  if (!hasIssues && noIssuesMessage) {
    console.log(colors.green('✅ Flutter Doctor tüm kontrollerden geçti.'));
    return true;
  }

  console.error(colors.red('❌ Flutter Doctor bazı kontrollerde başarısız. Yukarıdaki raporu inceleyip gereksinimleri tamamlayın.'));
  return false;
}

function checkFlutterUpdateStatus() {
  const result = runCommand('flutter', ['upgrade', '--verify-only']);

  if (!result.success) {
    console.warn(
      colors.yellow(
        `⚠️  Flutter güncelleme doğrulaması yapılamadı (${result.stderr || 'bilinmeyen hata'}). Manuel kontrol gerekebilir.`
      )
    );
    return { status: 'unknown' };
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();

  if (combinedOutput.includes('already up to date') || combinedOutput.includes('already up-to-date')) {
    return { status: 'up_to_date' };
  }

  if (combinedOutput.includes('new version of flutter') || combinedOutput.includes('a newer version of flutter')) {
    return { status: 'needs_update' };
  }

  if (combinedOutput.includes('upgrading flutter')) {
    return { status: 'needs_update' };
  }

  return { status: 'unknown' };
}

function checkFastlaneUpdateStatus() {
  const hasBrew = commandExists('brew');
  const hasGem = commandExists('gem');

  if (hasBrew) {
    const brewResult = runCommand('brew', ['outdated', 'fastlane', '--quiet']);
    if (brewResult.success) {
      const trimmed = brewResult.stdout.trim();
      if (!trimmed) {
        return { status: 'up_to_date' };
      }

      if (trimmed.split(/\r?\n/).some((line) => line.trim() === 'fastlane')) {
        return {
          status: 'needs_update',
          message: '⚠️  Homebrew deponuzda fastlane için güncelleme bulundu.',
          command: 'brew upgrade fastlane',
        };
      }
    }
  }

  if (hasGem) {
    const gemResult = runCommand('gem', ['outdated', 'fastlane']);
    if (gemResult.success) {
      const trimmed = gemResult.stdout.trim();
      if (!trimmed) {
        return { status: 'up_to_date' };
      }

      if (trimmed.includes('fastlane')) {
        return {
          status: 'needs_update',
          message: '⚠️  RubyGems reposunda fastlane için güncelleme bulundu.',
          command: 'gem update fastlane',
        };
      }
    }
  }

  if (!hasBrew && !hasGem) {
    console.warn(colors.yellow('⚠️  Fastlane güncelleme kontrolü için Homebrew veya RubyGems bulunamadı.'));
  }

  return { status: 'unknown' };
}

function extractFastlaneVersion(output) {
  if (!output) {
    return 'bilinmiyor';
  }

  const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    return `fastlane ${versionMatch[1]}`;
  }

  return output.split(/\r?\n/)[0].trim();
}

module.exports = doctorCommand;
