/**
 * electron-builder afterSign hook for Apple notarization.
 * Uses the "bcorp-mint" keychain profile stored via:
 *   xcrun notarytool store-credentials "bcorp-mint" --apple-id ... --team-id ... --password ...
 */
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization — not macOS');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  await notarize({
    tool: 'notarytool',
    appPath,
    keychainProfile: 'bcorp-mint',
  });

  console.log('Notarization complete.');
};
