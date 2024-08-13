/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@shadcn-components/ui/button'
import { Printer } from 'lucide-react'
import { useToast } from '@shadcn-components/ui/use-toast'

const stringToNumericCode = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  let code = Math.abs(hash).toString()
  // Ensure the code is 12 digits long for UPC-A or 13 for EAN-13
  code = code.padStart(12, '0').substring(0, 12)
  return code
}

const EditProductBarcodeGenerator = ({
  setUpdateData,
  updateData,
  product,
}) => {
  const barcodeRef = useRef(null)
  const printRef = useRef(null)
  const [isExist, setIsExist] = useState(false)
  const [isEmpty, setEmpty] = useState(false)
  const { toast } = useToast()

  const generateBarcode = (code) => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, code, {
        format: 'CODE128',
        lineColor: '#000',
        width: 2,
        height: 100,
        displayValue: true
      })
    }
  }

  const handleProductNameChange = () => {

    if(product.name === updateData.name){
      console.log('Product Name is the same as the product name')
      const code = stringToNumericCode(product.name)
      generateBarcode(code)
      return
    }
    if (updateData.name) {
      setEmpty(false)
      try {
        window.electron.ipcRenderer.send('generateCodeBar', updateData.name)
        window.electron.ipcRenderer.once('generateCodeBar:response', (event, response) => {
          if (!response.success) {
            setIsExist(true)
            generateBarcode(null)
            toast({
              description: `The Product Name - ${updateData.name} - already exists`,
              variant: 'destructive'
            })
          } else {
            setIsExist(false)
            const code = stringToNumericCode(updateData.name)
            generateBarcode(code)
            setUpdateData((prevState) => ({ ...prevState, barcode: code }))
          }
        })
      } catch (error) {
        console.error('Error handling product name change:', error.message)
        generateBarcode(null)
      }
    } else {
      setEmpty(true)
      generateBarcode(null)
    }
  }

  
  useEffect(()=>{
    handleProductNameChange()
  }, [updateData.name])

  // Generate the barcode on first load
  useEffect(()=>{
    const code = stringToNumericCode(product.name)
    setEmpty(false)
    generateBarcode(code)
    console.log('updateData.name: ', updateData.name)
  }, [])

  const handlePrint = useReactToPrint({
    content: () => printRef.current
  })

  return (
    <div className="flex flex-col gap-4 w-full ">
      {isEmpty && <p className="text-red-500 text-center">Please provide a product name.</p>}
      <Button
        type="button"
        className="flex gap-2"
        variant="outline"
        onClick={handlePrint}
        disabled={isExist || isEmpty}
      >
        <Printer className="w-5" />
        <span>Print Barcode</span>
      </Button>
      <div ref={printRef} className="print-container w-full">
        <p className="text-center font-bold mb-0 pb-0">
          {updateData.price ? `${updateData.price} DA` : `${product.price} DA`}
        </p>
        <div className="w-full">
          <svg className="mx-auto" ref={barcodeRef}></svg>
        </div>
      </div>
    </div>
  )
}

export default EditProductBarcodeGenerator
