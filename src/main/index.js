/* eslint-disable prettier/prettier */
import { app, shell, BrowserWindow} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
const {ipcMain} = require('electron')
const db = require("../../src/database/models");
// const productControlers = require('/../src/controlers/productControler')
const productControlers = require(__dirname + '/../../src/database/controlers/productControler')

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  
  
  mainWindow.on('ready-to-show', () => {
    mainWindow.webContents.openDevTools()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  // Connecting Database
  db.sequelize.sync({alter:true}).then(()=>{
    console.log('connection established')
  })
  
  productControlers.createNewProduct()
  productControlers.getProducts()
  productControlers.deleteProductById()
  productControlers.updateProductById()
  productControlers.getCategories()
  productControlers.createNewCategory()
  
}





// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })


  // ipcMain.on('newProductData', (event, newProductData) =>{
  //   console.log('hello', newProductData)

  // })
  
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.


// Electron app consists of of two process:
// 1. Main Process: - the entry point for the app
//                  - runs in a Node.js environment
//                  - is responsible for managing the lifecycle of the application
//                  - and interacting with the operating system
// 2. Renderer Process: - handle the user interface

// Inter-Process Communication (IPC):
//      - Electron provides a mechanism called IPC to facilitate communication between the main process and renderer processes.
//      - IPC allows you to send messages, transfer data, and trigger actions between different parts of your application.
//      - ipcRenderer.send('message', 'Hello from renderer process!') ===>> send a message with the channel name 'message' and the payload 'Hello from renderer process!' to the main process.
//      - ipcMain.on('message', (event, message) => {console.log(message)}) ===> adds an event listener to the ipcMain module to handle messages on the 'message' channel from renderer processes.    