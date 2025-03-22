/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@shadcn-components/ui/button'
import { Printer } from 'lucide-react'
import { useToast } from '@shadcn-components/ui/use-toast'


const BarcodeGenerator = ({ productData, setBarCode, setError, setValue, isEditMode }) => {
  const barcodeRef = useRef(null)
  const printRef = useRef(null)
  const { toast } = useToast()

  /**
   * Generates a barcode 
   * Uses Electron IPC to check if the PRODUCT NAME already exists.
   */
  
  const generateCodeBar = () => {
    try {
      window.electron.ipcRenderer.send('isBarCodeExist', productData.name)

      window.electron.ipcRenderer.once('isBarCodeExist:response', (_, response) => {
        if (response.isProductNameExist) {
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
          setError('name', { type: 'manual', message: 'The product name already exists' })
        } else {
          const code = response.code
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
            setValue('barCode', code, { shouldDirty: true }); // ✅ Marks field as changed
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


  const handlePrint = useReactToPrint({
    content: () => printRef.current
  })

  /**
   * Auto-generate barcode only in edit mode
   */
  useEffect(() => {
    if (productData?.barCode) {
      JsBarcode(barcodeRef.current, productData.barCode.toString(), {
        format: "CODE128",
        lineColor: "#000",
        width: 1.2,
        height: 28,
        displayValue: true,
        fontSize: 14,
        textMargin: 1,
        margin: 0,
      });
    }
  }, [productData?.barCode]); // Re-run when barcode exists (Edit mode)
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Generate BarCode BTN */}
      <Button type="button" className="flex gap-2" variant="outline" onClick={()=>generateCodeBar()} disabled={!productData?.name}>
        <span>Generate BarCode</span>
      </Button>

      <div ref={printRef} className="flex flex-col items-center">
        {productData?.price && (
          <p className="text-center font-bold m-0 text-sm">{productData.price} DA</p>
        )}
        <svg ref={barcodeRef} className="barcode" />
      </div>
      {/* Print BarCode BTN */}
      <Button
        type="button"
        className="flex gap-2"
        variant="outline"
        onClick={handlePrint}
        disabled={!productData?.barCode}
      >
        <Printer className="w-5" />
        <span>Print Barcode</span>
      </Button>
    </div>
  )
}

export default BarcodeGenerator
