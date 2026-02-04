/**
 * KHAYABEATS Desktop - Preload Script
 * 
 * This script runs in the renderer context before any web content loads.
 * It provides a safe bridge between the web app and Electron APIs.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose limited APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('app:minimize'),
  maximize: () => ipcRenderer.invoke('app:maximize'),
  close: () => ipcRenderer.invoke('app:close'),
  
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // Platform info
  platform: process.platform,
  isElectron: true,
});

// Expose player control bridge for system tray
contextBridge.exposeInMainWorld('khayabeats', {
  togglePlay: null,
  next: null,
  previous: null,
  pause: null,
});

console.log('KHAYABEATS Desktop: Preload script loaded');
