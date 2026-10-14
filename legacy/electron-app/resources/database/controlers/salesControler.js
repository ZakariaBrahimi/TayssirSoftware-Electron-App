/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
const { ipcMain } = require('electron') // Destructure ipcMain from electron
const db = require('../models') // Require the models
const { Op } = require('sequelize')

const newSoldProducts = () => {
  ipcMain.on('newSoldProducts', async (event, newSoldProductsData) => {
    console.log('Received new sold products data:', newSoldProductsData);

    try {
      // Create a new sold product in the database
      await Promise.all(newSoldProductsData.map(async (soldProduct) => {
        const newSoldProduct = await db.Sale.create({
          productId: soldProduct.product.id,
          quantity: soldProduct.quantity,
          discount: soldProduct.discount,
        });
        console.log('newSoldProduct.productId: ', newSoldProduct.productId)
        const currentProduct = await db.Product.findByPk(newSoldProduct.productId)
        console.log('currentProduct: ', currentProduct)
        if (currentProduct) {
          // Update the current product (e.g., decrement the stock quantity)
          await currentProduct.update({
            quantity: currentProduct.quantity - newSoldProduct.quantity,
          });
        } else {
          console.warn(`Product with ID ${newSoldProduct.productId} not found.`);
        }
      }));

      // Fetch all Sales to send back to the renderer process
      const sales = await db.Sale.findAll({
        include: [
          {
            model: db.Product,
            as: 'product', // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          },
        ],
        attributes: { exclude: ['productId'] }
      });
      
      // Convert Sequelize instances to plain objects
      const plainSoldProducts = sales.map((sale) => sale.get({ plain: true }));
      
      // Send a success message back to the renderer process
      event.reply('newSoldProducts:response', { success: true, sales: plainSoldProducts });
    } catch (error) {
      console.error('Error creating new sold product:', error);

      // Send an error message back to the renderer process
      event.reply('newSoldProducts:response', { success: false, error: error.message });
    }
  });
};
// Function to get the list of products
const getSoldProducts = () => {
  ipcMain.on('getSoldProducts', async (event, dateTime) => {
    console.log('Getting Sold Products List')
    console.log('date and Time: ' + dateTime)

    try {
      // Fetch all sold products from the database, including the associated product
      const soldProducts = await db.Sale.findAll({
        include: [
          {
            model: db.Product,
            as: 'product' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          }
        ],
        attributes: { exclude: ['productId'] }
      })
      // Convert Sequelize instances to plain objects
      const plainSoldProducts = soldProducts.map((product) => product.get({ plain: true }))
      console.log('Products List:', plainSoldProducts)

      // Send a success message back to the renderer process
      event.reply('getSoldProducts:response', { success: true, sales: plainSoldProducts })
    } catch (error) {
      console.error('Error getting sold products list:', error)

      // Send an error message back to the renderer process
      event.reply('getSoldProducts:response', { success: false, error: error.message })
    }
  })
}
const getSoldProductsAtDateTime = () => {
  ipcMain.on('getSoldProductsAtDateTime', async (event, { from, to }) => {
    console.log('Getting Sold Products List');
    console.log('From Date:', from, 'To Date:', to);

    try {
      // Convert dates to start and end of the day for accurate filtering
      const startDate = new Date(from);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);

      // Fetch all sold products from the database, including the associated product, filtered by date range
      const soldProducts = await db.Sale.findAll({
        where: {
          saleDate: {
            [Op.between]: [startDate, endDate]
          }
        },
        include: [
          {
            model: db.Product,
            as: 'product' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          }
        ],
        attributes: { exclude: ['productId'] }
      });
      // Convert Sequelize instances to plain objects
      const plainSoldProducts = soldProducts.map((product) => product.get({ plain: true }));
      console.log('Products List:', plainSoldProducts);

      // Send a success message back to the renderer process
      event.reply('getSoldProductsAtDateTime:response', { success: true, sales: plainSoldProducts });
    } catch (error) {
      console.error('Error getting sold products list:', error);

      // Send an error message back to the renderer process
      event.reply('getSoldProductsAtDateTime:response', { success: false, error: error.message });
    }
  });
};
// Export the functions to handle IPC events
module.exports = {
  newSoldProducts,
  getSoldProducts,
  getSoldProductsAtDateTime
  }