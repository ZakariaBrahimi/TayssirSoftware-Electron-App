/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { createContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@shadcn-components/ui/use-toast'

const SalesContext = createContext()
export default SalesContext

export const SalesProvider = ({ children }) => {
  const { toast } = useToast()
  const [soldProducts, setSoldProducts] = useState([])

  const newSoldProducts = (newSoldProductsData, setDialogIsOpen) => {
    // Sending data to the main process on 'newSoldProducts' channel
    console.log('New Sold Products List: ', newSoldProductsData)
    window.electron.ipcRenderer.send('newSoldProducts', newSoldProductsData)
    console.log('sent done')
    // Listen for the response from the main process using 'once' to ensure it's handled only once
    window.electron.ipcRenderer.once('newSoldProducts:response', (event, response) => {
      console.log('response received')
      if (response.success) {
        setSoldProducts(response.sales)
        setDialogIsOpen(false)
        toast({
          description: 'Products Sold successfully',
          variant: 'success'
        })
        console.log('Products Sold successfully:', response.sales)
      } else {
        console.log(response.error)
        console.error('Error Solding Products:', response.error)
      }
    })
  }

  const getSoldProducts = () => {
    console.log('getting sold products list')

    // Sending data to the main process on 'getSoldProducts' channel
    window.electron.ipcRenderer.send('getSoldProducts')
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getSoldProducts:response', (event, response) => {
      if (response.success) {
        console.log('Getting Sold Products list successfully:', response.sales)
        setSoldProducts(response.sales)
      } else {
        console.error('Error Getting Sold Products list:', response.error)
      }
    })
  }
  const getSoldProductsAtDateTime = (dateTime) => {
    console.log('getting sold products list on date and time', dateTime)

    // Sending data to the main process on 'getSoldProducts' channel
    window.electron.ipcRenderer.send('getSoldProductsAtDateTime', dateTime)
    // Listen for the response from the main process
    window.electron.ipcRenderer.on('getSoldProductsAtDateTime:response', (event, response) => {
      if (response.success) {
        console.log('Getting Sold Products list successfully:', response.sales)
        setSoldProducts(response.sales)
      } else {
        console.error('Error Getting Sold Products list:', response.error)
      }
    })
  }
  const contextData = {
    newSoldProducts,
    soldProducts,
    getSoldProducts,
    getSoldProductsAtDateTime
  }
  return <SalesContext.Provider value={contextData}>{children}</SalesContext.Provider>
}
