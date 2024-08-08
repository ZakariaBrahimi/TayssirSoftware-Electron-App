/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@shadcn-components/ui/button'
import { Barcode, Printer } from 'lucide-react'
import { Input } from '@shadcn-components/ui/input'
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
  if (code.length < 12) {
    code = code.padStart(12, '0')
  } else if (code.length > 12) {
    code = code.substring(0, 12)
  }
  return code
}

const BarcodeGenerator = ({ productName, setProductData, barcodePrice, productData, type }) => {
  const barcodeRef = useRef(null)
  const printRef = useRef(null)
  const [isExist, setIsExist] = useState(false)
  const { toast } = useToast()
  const generateCodeBar = () => {
    if (productName) {
      window.electron.ipcRenderer.send('generateCodeBar', productName)
      window.electron.ipcRenderer.once('generateCodeBar:response', (event, response) => {
        if (response.success) {
          setIsExist(false)
          const code = stringToNumericCode(productName)
          setProductData((prevState) => ({ ...prevState, barcode: code }))
          if (barcodeRef.current) {
            try {
              JsBarcode(barcodeRef.current, code, {
                format: 'CODE128',
                lineColor: '#000',
                width: 2,
                height: 100,
                displayValue: true
              })
              setProductData((prevState) => ({ ...prevState, barcode: code }))
            } catch (e) {
              console.error('Error generating barcode:', e.message)
            }
          }
        } else {
          setIsExist(true)
          console.error('Error generating barcode: ', response.message)
          JsBarcode(barcodeRef.current, null)
          toast({
            description: `The Product Name - ${productName} - already Exist`,
            variant: 'destructive'
          })
          setProductData((prevState) => ({ ...prevState, barcode: null }))
        }
      })
    } else {
      console.error("Barcode can't be generated, provide a product name please")
      JsBarcode(barcodeRef.current, null)
    }
  }
  const editProductGenerator = ()=>{
    try {
      JsBarcode(barcodeRef.current, productData?.barcode, {
        format: 'CODE128',
        lineColor: '#000',
        width: 2,
        height: 100,
        displayValue: true
      })
      console.log('Product: ', productData)
    } catch (e) {
      console.error('Error generating barcode:', e.message)
    }
    productName && generateCodeBar()
  }
  // Handle Product Name Change
  useEffect(() => {
    type === 'addProduct' ? generateCodeBar() : editProductGenerator()
  }, [productName])

  const handlePrint = useReactToPrint({
    content: () => printRef.current
  })

  return type === 'addProduct' ? (
    <div className="flex flex-col gap-4 w-full ite">
      {productName && !isExist ? (
        <Button type="button" className="flex gap-2" variant="outline" onClick={handlePrint}>
          <Printer className="w-5" />
          <span>Print Barcode</span>
        </Button>
      ) : (
        <Button type="button" disabled className="flex gap-2" variant="outline">
          <Printer className="w-5" />
          <span>Print Barcode</span>
        </Button>
      )}
      <div ref={printRef} className="print-container w-full">
        <p className="text-center font-bold mb-0 pb-0">{barcodePrice && barcodePrice + ' DA'} </p>
        <div className="w-full">
          <svg className=" mx-auto" ref={barcodeRef}></svg>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-4 w-full ite">
      
        <Button type="button" className="flex gap-2" variant="outline" onClick={handlePrint}>
          <Printer className="w-5" />
          <span>Print Barcode</span>
        </Button>
      
        <div ref={printRef} className="print-container w-full">
        <p className="text-center font-bold mb-0 pb-0">{barcodePrice && barcodePrice + ' DA'} </p>
        <div className="w-full">
          <svg className=" mx-auto" ref={barcodeRef}></svg>
        </div>
      </div>
      
    </div>
  )
}

export default BarcodeGenerator
