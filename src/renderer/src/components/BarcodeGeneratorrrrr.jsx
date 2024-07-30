/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@shadcn-components/ui/button'
import { Barcode, Printer } from 'lucide-react'
import { Input } from '@shadcn-components/ui/input'

const BarcodeGenerator = ({ test, setNewProductData }) => {
  const barcodeRef = useRef(null)
  const printRef = useRef(null)
  const [text, setText] = useState('')
  const [isExist, setIsExist] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [numericCode, setNumericCode] = useState()

  const stringToNumericCode = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString()
  }

  const generateCodeBar = () => {
    if (test) {
      console.log('generating code bargggggggggggggg')
      window.electron.ipcRenderer.send('generateCodeBar', test)
      window.electron.ipcRenderer.once('generateCodeBar:response', (event, response) => {
        console.log('response:', response)
        if (response.success) {
          setText(test)
          setIsExist(false)
          setIsEmpty(false)
          console.log('Barcode generated')
        } else {
          console.log('Error generating barcode: ', response.message)
          setIsExist(true)
        }
      })
    } else {
      console.log("Barcode can't be generated, provide a product name please")
      setIsEmpty(true)
    }
  }

  useEffect(() => {
    setNumericCode(stringToNumericCode(text))
    if (barcodeRef.current && text) {
      try {
        JsBarcode(barcodeRef.current, numericCode, {
          format: 'CODE128',
          lineColor: '#000',
          width: 2,
          height: 100,
          displayValue: true
        })
        setNewProductData((prevState) => ({ ...prevState, barcode: numericCode }))
      } catch (e) {
        console.error('Error generating barcode:', e.message)
      }
    }
  }, [text, numericCode])

  const handlePrint = useReactToPrint({
    content: () => printRef.current
  })

  return (
    <div className="flex gap-4 w-full ">
      <div className="flex-shrink w-full">
        <Input id="codeBar" value={text && numericCode} type="text" required className=" w-full " />
        {isExist && <p className="text-red-500 text-sm pl-3 ">The Product Name already Exist.</p>}
        {isEmpty && (
          <p className="text-red-500 text-sm pl-3  ">
            Please enter a product name to generate a barcode.
          </p>
        )}
      </div>
      <Button
        type="button"
        variant=""
        onClick={generateCodeBar}
        className="generate-button w-fit flex gap-2"
      >
        <Barcode className="w-5" />
        <span>Generate</span>
      </Button>
      <div ref={printRef} className="print-container hidden">
        <p className="text-center font-bold">{1995}</p>
        <svg ref={barcodeRef}></svg>
      </div>
      {text ? (
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
    </div>
  )
}

export default BarcodeGenerator
