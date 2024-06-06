/* eslint-disable prettier/prettier */
const { ipcMain } = require('electron') // Destructure ipcMain from electron
const db = require('../models') // Require the models

// Function to create a new product
const createNewProduct = () => {
  ipcMain.on('createNewProduct', async (event, newProductData) => {
    console.log('Received new product data:', newProductData)

    try {
      // Create a new product in the database
      const newProduct = await db.Product.create(newProductData)
      console.log('New product created:', newProduct)

      // Fetch all products to send back to the renderer process
      const products = await db.Product.findAll({
        include: [
          {
            model: db.Category,
            as: 'category' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          },
          {
            model: db.Brand,
            as: 'brand' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          }
        ],
        attributes: { exclude: ['categoryId', 'brandId'] }
      })
      // Convert Sequelize instances to plain objects
      const plainProducts = products.map((product) => product.get({ plain: true }))

      // Send a success message back to the renderer process
      event.reply('createNewProduct:response', { success: true, products: plainProducts })
    } catch (error) {
      console.error('Error creating new product:', error)

      // Send an error message back to the renderer process
      event.reply('createNewProduct:response', { success: false, error: error.message })
    }
  })
}
// Function to create a new category
const createNewCategory = () => {
  ipcMain.on('createNewCategory', async (event, newCategory) => {
    console.log('Received new category data:', newCategory)

    try {
      // Create a new category in the database
      const newCategoryData = await db.Category.create(newCategory)
      console.log('New category created:', newCategoryData)

      // Fetch all categories to send back to the renderer process
      const categories = await db.Category.findAll()

      // Send a success message back to the renderer process
      event.reply('createNewCategory:response', { success: true, categories: categories })
    } catch (error) {
      console.error('Error creating new category:', error)

      // Send an error message back to the renderer process
      event.reply('createNewCategory:response', { success: false, error: error.message })
    }
  })
}
// Function to create a new brand
const createNewProductBrand = () => {
  ipcMain.on('createNewProductBrand', async (event, newBrand) => {
    console.log('Received new brand name:', newBrand)

    try {
      // Create a new brand in the database
      const newBrandData = await db.Brand.create(newBrand)
      console.log('New brand created:', newBrandData)

      // Fetch all brands to send back to the renderer process
      const brands = await db.Brand.findAll()

      // Send a success message back to the renderer process
      event.reply('createNewProductBrand:response', { success: true, brands: brands })
    } catch (error) {
      console.error('Error creating new brand:', error)

      // Send an error message back to the renderer process
      event.reply('createNewProductBrand:response', { success: false, error: error.message })
    }
  })
}

// Function to get the list of products
const getProducts = () => {
  ipcMain.on('getProducts', async (event) => {
    console.log('Getting Products List')

    try {
      // Fetch all products from the database, including the associated category
      const products = await db.Product.findAll({
        include: [
          {
            model: db.Category,
            as: 'category' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          },
          {
            model: db.Brand,
            as: 'brand' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          }
        ],
        attributes: { exclude: ['categoryId', 'brandId'] }
      })
      // Convert Sequelize instances to plain objects
      const plainProducts = products.map((product) => product.get({ plain: true }))
      console.log('Products List:', plainProducts)

      // Send a success message back to the renderer process
      event.reply('getProducts:response', { success: true, products: plainProducts })
    } catch (error) {
      console.error('Error getting products list:', error)

      // Send an error message back to the renderer process
      event.reply('getProducts:response', { success: false, error: error.message })
    }
  })
}
// Function to get the list of Categories
const getCategories = () => {
  ipcMain.on('getCategories', async (event) => {
    console.log('Getting Categories List')

    try {
      // Fetch all Categories from the database
      const categories = await db.Category.findAll()
      console.log('Categories List:', categories)

      // Send a success message back to the renderer process
      event.reply('getCategories:response', { success: true, categories: categories })
    } catch (error) {
      console.error('Error getting Categories list:', error)

      // Send an error message back to the renderer process
      event.reply('getCategories:response', { success: false, error: error.message })
    }
  })
}
// Function to get the list of Categories
const getProductBrands = () => {
  ipcMain.on('getProductBrands', async (event) => {
    console.log('Getting brands List')

    try {
      // Fetch all brands from the database
      const brands = await db.Brand.findAll()
      console.log('Brands List:', brands)

      // Send a success message back to the renderer process
      event.reply('getProductBrands:response', { success: true, brands: brands })
    } catch (error) {
      console.error('Error getting Categories list:', error)

      // Send an error message back to the renderer process
      event.reply('getProductBrands:response', { success: false, error: error.message })
    }
  })
}

// Function to delete a product by ID
const deleteProductById = () => {
  ipcMain.on('deleteProductById', async (event, productId) => {
    console.log('Deleting product with ID:', productId)

    try {
      // This is soft-deletion, if you want hard-deletion add {force:true} to destroy options
      const result = await db.Product.destroy({
        where: { id: productId }
      })
      if (result) {
        console.log('Product deleted successfully')
        // Fetch all products to send back to the renderer process
      const products = await db.Product.findAll({
        include: [
          {
            model: db.Category,
            as: 'category' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          },
          {
            model: db.Brand,
            as: 'brand' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          }
        ],
        attributes: { exclude: ['categoryId', 'brandId'] }
      })
      // Convert Sequelize instances to plain objects
      const plainProducts = products.map((product) => product.get({ plain: true }))

        event.reply('deleteProductById:response', { success: true, products: plainProducts })
      } else {
        console.log('Product not found')
        event.reply('deleteProductById:response', { success: false, error: 'Product not found' })
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      event.reply('deleteProductById:response', { success: false, error: error.message })
    }
  })
}
// Function to Update a product data by ID
const updateProductById = () => {
  ipcMain.on('updateProductById', async (event, { productId, updateData }) => {
    console.log('Updating product with ID:', productId, 'with data:', updateData)

    try {
      const [updated] = await db.Product.update(updateData, {
        where: { id: productId }
      })

      if (updated) {
        console.log('Product updated successfully')
        // Fetch the updated product to send back to the renderer process
        // const updatedProduct = await db.Product.findByPk(productId);
        // event.reply('updateProductById:response', { success: true, product: updatedProduct });
        // Fetch the updated products to send back to the renderer process
        // Fetch all products to send back to the renderer process
      const products = await db.Product.findAll({
        include: [
          {
            model: db.Category,
            as: 'category' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          },
          {
            model: db.Brand,
            as: 'brand' // Use the alias defined in the association
            // attributes: ['id', 'name'] // Include only the necessary attributes
          }
        ],
        attributes: { exclude: ['categoryId', 'brandId'] }
      })
      // Convert Sequelize instances to plain objects
      const plainProducts = products.map((product) => product.get({ plain: true }))

        event.reply('updateProductById:response', { success: true, products: plainProducts })
      } else {
        console.log('Product not found or no changes made')
        event.reply('updateProductById:response', {
          success: false,
          error: 'Product not found or no changes made'
        })
      }
    } catch (error) {
      console.error('Error updating product:', error)
      event.reply('updateProductById:response', { success: false, error: error.message })
    }
  })
}

// Export the functions to handle IPC events
module.exports = {
  createNewProduct,
  getProducts,
  deleteProductById,
  updateProductById,
  getCategories,
  createNewCategory,
  createNewProductBrand,
  getProductBrands
}
