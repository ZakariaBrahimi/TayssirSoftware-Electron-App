/* eslint-disable prettier/prettier */
const { ipcMain } = require('electron'); // Destructure ipcMain from electron
const db = require('../models'); // Require the models

// Function to create a new product
const createNewProduct = () => {
    ipcMain.on('createNewProduct', async (event, newProductData) => {
        console.log('Received new product data:', newProductData);

        try {
            // Create a new product in the database
            const newProduct = await db.Product.create(newProductData);
            console.log('New product created:', newProduct);

            // Fetch all products to send back to the renderer process
            const products = await db.Product.findAll();
            
            // Send a success message back to the renderer process
            event.reply('createNewProduct:response', { success: true, products: products });
        } catch (error) {
            console.error('Error creating new product:', error);

            // Send an error message back to the renderer process
            event.reply('createNewProduct:response', { success: false, error: error.message });
        }
    });
};

// Function to get the list of products
const getProducts = () => {
    ipcMain.on('getProducts', async (event) => {
        console.log('Getting Products List');

        try {
            // Fetch all products from the database
            const products = await db.Product.findAll();
            console.log('Products List:', products);

            // Send a success message back to the renderer process
            event.reply('getProducts:response', { success: true, products: products });
        } catch (error) {
            console.error('Error getting products list:', error);

            // Send an error message back to the renderer process
            event.reply('getProducts:response', { success: false, error: error.message });
        }
    });
};

// Export the functions to handle IPC events
module.exports = { createNewProduct, getProducts };
