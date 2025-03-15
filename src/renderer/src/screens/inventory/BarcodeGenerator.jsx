/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@shadcn-components/ui/button'
import { Printer } from 'lucide-react'
import { useToast } from '@shadcn-components/ui/use-toast'

/**
 * Converts a string to a 12-digit numeric barcode.
 * Ensures the barcode meets CODE128 format requirements.
 */
const stringToNumericCode = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash >>> 0 // Convert to 32-bit unsigned integer
  }
  let code = Math.abs(hash).toString()
  return code.padStart(12, '0').slice(0, 12)
}

const BarcodeGenerator = ({ productData, setBarCode, setError }) => {
  const barcodeRef = useRef(null)
  const printRef = useRef(null)
  const { toast } = useToast()
  const [isBarcodeDuplicate, setIsBarcodeDuplicate] = useState(false)

  /**
   * Generates a barcode from the product name.
   * Uses Electron IPC to check if the barcode already exists.
   */
  const generateCodeBar = () => {
    try {
      window.electron.ipcRenderer.send('isBarCodeExist', productData.name)
      /*
          Creating a New Product:
          When typing a name, check if a product with the same name exists.
          If yes, raise an error.
          If no, generate a new barcode.
          
          Editing an Existing Product:
          If the new name is exactly the same as the existing product name, do nothing (no new barcode).
          If the new name is different:
          Check if another product already has this name.
          If yes, raise an error.
          If no, update the name without changing the barcode.
          
          
          */
      window.electron.ipcRenderer.once('isBarCodeExist:response', (_, response) => {
        if (response.isProductNameExist) {
          setIsBarcodeDuplicate(true)
          JsBarcode(barcodeRef.current, null, {
            width: 1.2, // Adjust width based on label size --- good enough
            height: 28, // Adjust height based on label size
            displayValue: true,
            fontSize: 14, // Adjust font size dynamically   --- good enough
            textMargin: 1,
            margin: 0
          })
          toast({
            description: `The product name "${productData.name}" already exists.`,
            variant: 'destructive'
          })
          setBarCode('')
          setError('name', {type: 'manual', message: 'The product name already exists'})
        } else {
          setIsBarcodeDuplicate(false)
          const code = stringToNumericCode(productData?.name)
          if (barcodeRef.current) {
            JsBarcode(barcodeRef.current, code, {
              format: 'CODE128',
              lineColor: '#000',
              width: 1.2,
              height: 28,
              displayValue: true,
              fontSize: 14,
              textMargin: 1,
              margin: 0
            })
            setBarCode(code)
            console.log(typeof(code))
          }
        }
      })
    } catch (error) {
      console.error('Error generating barcode:', error.message)
      JsBarcode(barcodeRef.current, 'Bar Code', {
        width: 1.2,
        height: 28,
        displayValue: true,
        fontSize: 14,
        textMargin: 1,
        margin: 0
      })
    }
  }

  useEffect(() => {
    generateCodeBar()
  }, [productData?.name])

  const handlePrint = useReactToPrint({
    content: () => printRef.current
  })

  return (
    <div className="flex flex-col gap-4 w-full">
      <Button
        type="button"
        className="flex gap-2"
        variant="outline"
        onClick={handlePrint}
        disabled={
          isBarcodeDuplicate ||
          !productData?.name?.trim() || // Ensures the name field is not just empty spaces.
          !productData?.price
        }
      >
        <Printer className="w-5" />
        <span>Print Barcode</span>
      </Button>

      <div ref={printRef} className="flex flex-col items-center">
        {productData?.price && (
          <p className="text-center font-bold m-0 text-sm">{productData.price} DA</p>
        )}
        <svg ref={barcodeRef} className="barcode" />
      </div>
    </div>
  )
}

export default BarcodeGenerator
