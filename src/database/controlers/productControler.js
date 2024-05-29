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

// Function to delete a product by ID
const deleteProductById = () => {
    ipcMain.on('deleteProductById', async (event, productId) => {
        console.log('Deleting product with ID:', productId);

        try {
            // This is soft-deletion, if you want hard-deletion add {force:true} to destroy options
            const result = await db.Product.destroy({
                where: { id: productId }
            });
            if (result) {
                console.log('Product deleted successfully');
                // Fetch all products to send back to the renderer process
                const products = await db.Product.findAll();
                event.reply('deleteProductById:response', { success: true, products: products });
            } else {
                console.log('Product not found');
                event.reply('deleteProductById:response', { success: false, error: 'Product not found' });
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            event.reply('deleteProductById:response', { success: false, error: error.message });
        }
    });
};
// Function to Update a product data by ID
const updateProductById = () => {
    ipcMain.on('updateProductById', async (event, { productId, updateData }) => {
        console.log('Updating product with ID:', productId, 'with data:', updateData);

        try {
            const [updated] = await db.Product.update(updateData, {
                where: { id: productId }
            });

            if (updated) {
                console.log('Product updated successfully');
                // Fetch the updated product to send back to the renderer process
                // const updatedProduct = await db.Product.findByPk(productId);
                // event.reply('updateProductById:response', { success: true, product: updatedProduct });
                // Fetch the updated products to send back to the renderer process
                const updatedProducts = await db.Product.findAll();
                event.reply('updateProductById:response', { success: true, products: updatedProducts });
            } else {
                console.log('Product not found or no changes made');
                event.reply('updateProductById:response', { success: false, error: 'Product not found or no changes made' });
            }
        } catch (error) {
            console.error('Error updating product:', error);
            event.reply('updateProductById:response', { success: false, error: error.message });
        }
    });
};



// Export the functions to handle IPC events
module.exports = { createNewProduct, getProducts, deleteProductById, updateProductById };
