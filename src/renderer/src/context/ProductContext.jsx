/* eslint-disable prettier/prettier */
import { createContext, useState } from 'react';


const ProductContext = createContext()
export default ProductContext;

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([])
  const [newProductData, setNewProductData] = useState({
    name: '',
    quantity: 0,
    purchasing_price: 0,
    selling_price: 0
  })
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
    window.electron.ipcRenderer.send('createNewProduct', newProductData)
    console.log('sent done')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('createNewProduct:response', (event, response) => {
      console.log('response recieved')
      if (response.success) {
        console.log('success')
        setProducts(response.products )
        console.log('Product created successfully:', response.products)

      } else {
        console.log(response.error)
        console.error('Error creating product:', response.error)
      }
    })
  }
  
  const contextData = {getProducts, products, setProducts, createNewProduct, setNewProductData}
  return (
    <ProductContext.Provider value={contextData}>
      {children}
    </ProductContext.Provider>
  )
}
