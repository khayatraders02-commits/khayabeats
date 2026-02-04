/**
 * KHAYABEATS Desktop - Electron Forge Configuration
 * 
 * This configuration handles building and packaging the Windows installer.
 * Run: npm run make
 */

module.exports = {
  packagerConfig: {
    name: 'KHAYABEATS',
    executableName: 'khayabeats',
    icon: './public/app-icon',
    appBundleId: 'app.lovable.khayabeats',
    appCopyright: `Copyright © ${new Date().getFullYear()} KHAYABEATS`,
    asar: true,
    win32metadata: {
      CompanyName: 'KHAYABEATS',
      ProductName: 'KHAYABEATS',
      FileDescription: 'Stream unlimited music for free',
      OriginalFilename: 'khayabeats.exe',
    },
    // Only build for 64-bit
    arch: ['x64'],
    platform: ['win32', 'darwin', 'linux'],
  },
  rebuildConfig: {},
  makers: [
    // Windows - Squirrel installer (like Spotify, Discord)
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'khayabeats',
        setupExe: 'KHAYABEATS-Setup.exe',
        setupIcon: './public/app-icon.ico',
        loadingGif: './electron/assets/installing.gif',
        iconUrl: 'https://6abb415d-48b6-4355-8a5d-3186a7daeb44.lovableproject.com/app-icon.ico',
        // Auto-update configuration
        remoteReleases: '',
      },
    },
    // Windows - MSI installer (for enterprise)
    {
      name: '@electron-forge/maker-wix',
      config: {
        name: 'KHAYABEATS',
        manufacturer: 'KHAYABEATS',
        icon: './public/app-icon.ico',
        ui: {
          chooseDirectory: true,
        },
      },
    },
    // ZIP for portable version
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
    },
    // macOS DMG
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        icon: './public/app-icon.icns',
      },
    },
    // Linux DEB
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'KHAYABEATS',
          homepage: 'https://khayabeats.app',
          icon: './public/app-icon.png',
        },
      },
    },
    // Linux RPM
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: './public/app-icon.png',
        },
      },
    },
  ],
  publishers: [],
  plugins: [],
};
