/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { createContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@shadcn-components/ui/use-toast'

const ProductContext = createContext()
export default ProductContext

export const ProductProvider = ({ children }) => {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [categoryData, setCategoryData] = useState([])
  const [brandData, setBrandData] = useState([])
  const [newProductData, setNewProductData] = useState({
    userId: null,
    name: '',
    barcode: null,
    quantity: 0,
    cost: 0,
    price: 0,
    brand:'',
    category: ''
  })
  const { toast } = useToast()
  const getCategories = () => {
    // console.log('getting Categories list')

    // Sending data to the main process on 'getCategories' channel
    window.electron.ipcRenderer.send('getCategories')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getCategories:response', (event, response) => {
      if (response.success) {
        // console.log('Getting Categories list successfully:', response.categories)
        setCategories(response.categories)
      } else {
        console.error('Error Getting Products list:', response.error)
      }
    })
  }
  const getCategoryData = (categoryId) => {
    // console.log('getting Category list')

    // Sending data to the main process on 'getCategoryData' channel
    window.electron.ipcRenderer.send('getCategoryData')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getCategoryData:response', (event, response) => {
      if (response.success) {
        // console.log('Getting Category list successfully:', response.category)
        setCategoryData(response.category)
      } else {
        console.error('Error Getting Category Data:', response.error)
      }
    })
  }
  const getBrandData = (brandId) => {
    // console.log('getting Brand Data')

    // Sending data to the main process on 'getBrandData' channel
    window.electron.ipcRenderer.send('getBrandData')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getBrandData:response', (event, response) => {
      if (response.success) {
        // console.log('Getting Brand list successfully:', response.brand)
        setBrandData(response.brand)
      } else {
        console.error('Error Getting brand Data:', response.error)
      }
    })
  }
  const getProductBrands = () => {
    // console.log('getting brands list')

    // Sending data to the main process on 'getProductBrands' channel
    window.electron.ipcRenderer.send('getProductBrands')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getProductBrands:response', (event, response) => {
      if (response.success) {
        // console.log('Getting Brands list successfully:', response.brands)
        setBrands(response.brands)
      } else {
        console.error('Error Getting Brands list:', response.error)
      }
    })
  }
  const getProducts = () => {
    // console.log('getting products list')

    // Sending data to the main process on 'getProducts' channel
    window.electron.ipcRenderer.send('getProducts')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getProducts:response', (event, response) => {
      if (response.success) {
        // console.log('Getting Products list successfully:', response.products)
        setProducts(response.products)
      } else {
        console.error('Error Getting Products list:', response.error)
      }
    })
  }
  const createNewProduct = (event) => {
    event.preventDefault()
    
    window.electron.ipcRenderer.send('createNewProduct', newProductData)
    // Listen for the response from the main process using 'once' to ensure it's handled only once
    window.electron.ipcRenderer.once('createNewProduct:response', (event, response) => {
      if (response.success) {
        setProducts(response.products)
        navigate('/inventory')
        setNewProductData({
          name: '',
          quantity: 0,
          cost: 0,
          price: 0,
          brand: '',
          category: '',
        })
        toast({
          description: 'Product Created successfully',
          variant: 'success'
        })
        // console.log('Product created successfully:', response.products)
      } else {
        console.log(response.error)
        console.error('Error creating product:', response.error)
      }
    })
  }

  const createNewCategory = () => {
    // event.preventDefault()
    window.electron.ipcRenderer.send('createNewCategory', {name:newCategory})
    // Listen for the response from the main process using 'once' to ensure it's handled only once
    window.electron.ipcRenderer.once('createNewCategory:response', (event, response) => {
      if (response.success) {
        setCategories(response.categories)
        setNewCategory('')
        toast({
          description: 'New Category Created successfully',
          variant: 'success'
        })
        // console.log('Category created successfully:', response.categories)
      } else {
        console.log(response.error)
        console.error('Error creating New Category:', response.error)
      }
    })
  }
  const createNewProductBrand = () => {
    window.electron.ipcRenderer.send('createNewProductBrand', {name:newBrand})
    // Listen for the response from the main process using 'once' to ensure it's handled only once
    window.electron.ipcRenderer.once('createNewProductBrand:response', (event, response) => {
      if (response.success) {
        setBrands(response.brands)
        setNewBrand('')
        toast({
          description: 'New Brand Created successfully',
          variant: 'success'
        })
        // console.log('Brand created successfully:', response.brands)
      } else {
        console.log(response.error)
        console.error('Error creating New Brand:', response.error)
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
        // console.log('Product deleted successfully', response.products)
        setProducts(response.products)
      } else {
        console.log(response.error)
      }
    })
  }

  const [updateData, setUpdateData] = useState([])
  // Function to Update a product data by ID
  const updateProductById = (productId, updateData) => {
    window.electron.ipcRenderer.send('updateProductById', { productId, updateData })

    window.electron.ipcRenderer.once('updateProductById:response', (event, response) => {
      if (response.success) {
        // console.log('Product updated successfully:', response.products)
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
    newCategory,
    getCategoryData,
    categoryData,

    getProductBrands,
    brands,
    setBrands,
    newBrand, setNewBrand,
    createNewProductBrand,
    getBrandData,
    brandData

  }
  return <ProductContext.Provider value={contextData}>{children}</ProductContext.Provider>
}
