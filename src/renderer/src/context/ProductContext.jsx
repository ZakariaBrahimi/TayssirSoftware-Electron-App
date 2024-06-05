/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { createContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@shadcn-components/ui/use-toast'

const ProductContext = createContext()
export default ProductContext

export const ProductProvider = ({ children }) => {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [newProductData, setNewProductData] = useState({
    name: '',
    quantity: 0,
    purchasing_price: 0,
    selling_price: 0
  })
  const { toast } = useToast()
  const getCategories = () => {
    console.log('getting Categories list')

    // Sending data to the main process on 'getCategories' channel
    window.electron.ipcRenderer.send('getCategories')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getCategories:response', (event, response) => {
      if (response.success) {
        console.log('Getting Products list successfully:', response.categories)
        setCategories(response.products)
      } else {
        console.error('Error Getting Products list:', response.error)
      }
    })
  }
  const getProducts = () => {
    console.log('getting products list')

    // Sending data to the main process on 'createNewProduct' channel
    window.electron.ipcRenderer.send('getProducts')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getProducts:response', (event, response) => {
      if (response.success) {
        console.log('Getting Products list successfully:', response.products)
        setProducts(response.products)
      } else {
        console.error('Error Getting Products list:', response.error)
      }
    })
  }
  const createNewProduct = (event) => {
    event.preventDefault()
    console.log('before everything')
    // Sending data to the main process on 'createNewProduct' channel
    // TODO: should I do once() instead of send() !!!
    window.electron.ipcRenderer.send('createNewProduct', newProductData)
    console.log('sent done')
    // Listen for the response from the main process using 'once' to ensure it's handled only once
    window.electron.ipcRenderer.once('createNewProduct:response', (event, response) => {
      console.log('response received')
      if (response.success) {
        console.log('success')
        setProducts(response.products)
        navigate('/inventory')
        setNewProductData({
          name: '',
          quantity: 0,
          purchasing_price: 0,
          selling_price: 0
        })
        toast({
          description: 'Product Created successfully',
          variant: 'success'
        })
        console.log('Product created successfully:', response.products)
      } else {
        console.log(response.error)
        console.error('Error creating product:', response.error)
      }
    })
  }
  const createNewCategory = () => {
    // event.preventDefault()
    console.log('before everything')
    window.electron.ipcRenderer.send('createNewCategory', {name:newCategory})
    console.log('sent done')
    // Listen for the response from the main process using 'once' to ensure it's handled only once
    window.electron.ipcRenderer.once('createNewCategory:response', (event, response) => {
      console.log('response received')
      if (response.success) {
        console.log('success')
        setCategories(response.categories)
        // navigate('/inventory');
        setNewCategory('')
        toast({
          description: 'New Category Created successfully',
          variant: 'success'
        })
        console.log('Category created successfully:', response.categories)
      } else {
        console.log(response.error)
        console.error('Error creating New Category:', response.error)
      }
    })
  }

  // Function to Delete a Product from Database
  const deleteProductById = (productID) => {
    // Sending product Id to the Main Process on -deleteProductById- channel
    window.electron.ipcRenderer.send('deleteProductById', productID)
    // Listen for the response from the main process
    // Memory Leaks: Use once for the response listener to prevent memory leaks. ==> Adds a one time listener function for the event. This listener is invoked only the next time a message is sent to channel, after which it is removed
    window.electron.ipcRenderer.once('deleteProductById:response', (event, response) => {
      if (response.success) {
        console.log('Product deleted successfully', response.products)
        setProducts(response.products)

        // TODO: push success notification
      } else {
        console.log(response.error)
        // TODO: push error notification
      }
    })
  }

  const [updateData, setUpdateData] = useState([])
  // Function to Update a product data by ID
  const updateProductById = (productId, updateData) => {
    window.electron.ipcRenderer.send('updateProductById', { productId, updateData })

    window.electron.ipcRenderer.once('updateProductById:response', (event, response) => {
      if (response.success) {
        console.log('Product updated successfully:', response.products)
        // Handle success (e.g., update UI, show notification)
        setProducts(response.products) // FIXME: should not updates all products (it could be 10,000 products, it will be problem to update)
      } else {
        console.error('Error:', response.error)
      }
    })
  }
  const contextData = {
    getProducts,
    products,
    setProducts,
    createNewProduct,
    setNewProductData,
    deleteProductById,
    updateProductById,
    setUpdateData,
    updateData,
    getCategories,
    categories,
    setCategories,
    createNewCategory,
    setNewCategory,
    newCategory
  }
  return <ProductContext.Provider value={contextData}>{children}</ProductContext.Provider>
}
