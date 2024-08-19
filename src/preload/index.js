/* eslint-disable prettier/prettier */
import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
const fs = require('fs');
const path = require('path');
const os = require('os');
// const crypto = require('crypto');
const { createHmac } = require('node:crypto')
// Custom APIs for renderer
const api = {
  fs,
  path,
  os,
  createHmac,
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
