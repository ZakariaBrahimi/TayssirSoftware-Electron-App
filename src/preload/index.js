/* eslint-disable prettier/prettier */
import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto  = require('crypto')
const systeminformation = require('systeminformation');

// Custom APIs for renderer
const api = {
  fs,
  path,
  os,
  crypto,
  generateSHA256Hash: (input) => {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest('hex');
  },
  getHardwareInfo: async function getHardwareInfo() {
    const motherboard = await systeminformation.baseboard();
    const bios = await systeminformation.bios();
    // const cpu = await systeminformation.cpu();

    return {
        motherboardSerial: motherboard.serial,
        biosSerial: bios.serial,
        // cpuId: cpu.id,
    };}
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
