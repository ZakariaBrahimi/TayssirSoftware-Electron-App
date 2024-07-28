/* eslint-disable prettier/prettier */
const { ipcMain } = require('electron') // Destructure ipcMain from electron
const db = require('../models') // Require the models
const bcrypt = require('bcryptjs');


const login = ()=>{
    ipcMain.on('login', async (event, { username, password }) => {
        try {
          const user = await db.User.findOne({ where: { username } });
          if (user && await bcrypt.compare(password, user.password)) {
            event.reply('login:response', { success: true, user })
          } else {
            event.reply('login:response', { success: false, error: 'Incorrect username or password' })
          }
        } catch (error) {
            event.reply({ success: false, error: error.message })
        }
      });
}

module.exports = {
    login
}