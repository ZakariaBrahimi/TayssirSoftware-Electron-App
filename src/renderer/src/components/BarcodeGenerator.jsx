/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@shadcn-components/ui/button';
import { Barcode, Printer } from 'lucide-react';
import { Input } from '@shadcn-components/ui/input';

const stringToNumericCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  let code = Math.abs(hash).toString();
  // Ensure the code is 12 digits long for UPC-A or 13 for EAN-13
  if (code.length < 12) {
    code = code.padStart(12, '0');
  } else if (code.length > 12) {
    code = code.substring(0, 12);
  }
  return code;
};

const BarcodeGenerator = ({ productName, setNewProductData, barcodePrice, newProductData }) => {
  const barcodeRef = useRef(null);
  const printRef = useRef(null);
  const [state, setState] = useState({
    text: '',
    isExist: false,
    isEmpty: false,
    numericCode: '',
    showExistError: false,
  });

  const generateCodeBar = () => {
    if (productName) {
      window.electron.ipcRenderer.send('generateCodeBar', productName);
      window.electron.ipcRenderer.once('generateCodeBar:response', (event, response) => {
        if (response.success) {
          const code = stringToNumericCode(productName);
          setNewProductData((prevState) => ({ ...prevState, barcode: code }));
          if (barcodeRef.current) {
            try {
              JsBarcode(barcodeRef.current, code, {
                format: 'CODE128',
                lineColor: '#000',
                width: 2,
                height: 100,
                displayValue: true,
              });
              setNewProductData((prevState) => ({ ...prevState, barcode: code }));
            } catch (e) {
              console.error('Error generating barcode:', e.message);
            }
          }
          setState((prevState) => ({
            ...prevState,
            text: productName,
            isExist: false,
            isEmpty: false,
          }));
        } else {
          console.error('Error generating barcode: ', response.message);
          setState((prevState) => ({
            ...prevState,
            isExist: true,
            showExistError: true,
          }));
        }
      });
    } else {
      console.error("Barcode can't be generated, provide a product name please");
      setState((prevState) => ({ ...prevState, isEmpty: true }));
    }
  }

  
  // Handle Product Name Change
  useEffect(() => {
    generateCodeBar()
  }, [productName])

  // Handle Product Name Change
  useEffect(() => {}, [productName])
  // Handle Product Name Change
  useEffect(() => {}, [productName])
  

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  return (
    <div className="flex flex-col gap-4 w-full ite">
      {/* <div className="flex-shrink w-full">
        <Input
          id="codeBar"
          initialValue={newProductData && newProductData?.barcode}
          type="number"
          required
          className="w-full"
        />
        {state.isExist && state.showExistError && (
          <p className="text-red-500 text-sm pl-3 fade-out">
            The Product Name already exists.
          </p>
        )}
        {state.isEmpty && (
          <p className="text-red-500 text-sm pl-3">
            Please enter a product name to generate a barcode.
          </p>
        )}
      </div> */}
      {/* <Button
        type="button"
        onClick={generateCodeBar}
        className="generate-button w-fit flex gap-2"
      >
        <Barcode className="w-5" />
        <span>Generate</span>
      </Button> */}
      
      {state.text ? (
        <Button
          type="button"
          className="flex gap-2"
          variant="outline"
          onClick={handlePrint}
        >
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
        <p className="text-center font-bold mb-0 pb-0">{barcodePrice} DA</p>
        <div className='w-full'>
          <svg className=' mx-auto' ref={barcodeRef}></svg>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGenerator;
