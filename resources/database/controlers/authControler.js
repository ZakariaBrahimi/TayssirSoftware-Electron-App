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
const signup = () => {
  ipcMain.on('signup', async (event, { username, password }) => {
    try {
      // Check if the user already exists
      const existingUser = await db.User.findOne({ where: { username } });
      if (existingUser) {
        event.reply('signup:response', { success: false, error: 'Username already exists' });
        return;
      }

      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the new user
      const newUser = await db.User.create({ username, password: hashedPassword });

      event.reply('signup:response', { success: true, user: newUser });
    } catch (error) {
      event.reply('signup:response', { success: false, error: error.message });
    }
  });
};
module.exports = {
    
    signup,
    login
}