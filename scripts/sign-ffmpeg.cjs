/**
 * electron-builder afterPack hook — sign the ffmpeg binary with hardened runtime
 * before the main app signing pass, so notarization passes.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function signFfmpeg(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') return;

  // Find the signing identity from electron-builder's config
  const identity = process.env.CSC_NAME || 'Developer ID Application: Richard Boase (ZQ4NX9NJ89)';

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const ffmpegPath = path.join(appPath, 'Contents', 'Resources', 'ffmpeg');
  const entitlements = path.resolve(__dirname, '..', 'resources', 'entitlements.mac.plist');

  // Sign ffmpeg binary if it exists
  if (fs.existsSync(ffmpegPath)) {
    console.log(`Signing ffmpeg binary at ${ffmpegPath}...`);
    execSync(
      `codesign --sign "${identity}" --options runtime --timestamp --force --entitlements "${entitlements}" "${ffmpegPath}"`,
      { stdio: 'inherit' }
    );
    console.log('ffmpeg signed successfully.');
  }

  // Also re-sign Electron's libffmpeg.dylib with hardened runtime + timestamp
  const libFfmpegPath = path.join(
    appPath,
    'Contents', 'Frameworks', 'Electron Framework.framework',
    'Versions', 'A', 'Libraries', 'libffmpeg.dylib'
  );

  if (fs.existsSync(libFfmpegPath)) {
    console.log(`Signing libffmpeg.dylib at ${libFfmpegPath}...`);
    execSync(
      `codesign --sign "${identity}" --options runtime --timestamp --force "${libFfmpegPath}"`,
      { stdio: 'inherit' }
    );
    console.log('libffmpeg.dylib signed successfully.');
  }
};
