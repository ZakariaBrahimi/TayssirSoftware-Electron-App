/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { useReactToPrint } from "react-to-print";
import { Button } from "@shadcn-components/ui/button";
import { Printer } from "lucide-react";
import { useToast } from "@shadcn-components/ui/use-toast";

/**
 * Converts a string to a 12-digit numeric barcode.
 * Ensures the barcode meets CODE128 format requirements.
 */
const stringToNumericCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash >>> 0; // Convert to 32-bit unsigned integer
  }
  let code = Math.abs(hash).toString();
  return code.padStart(12, "0").slice(0, 12);
};

const AddProductBarcodeGenerator = ({
  newProductData1, handleBarcodeGenerated,
  setProductData,
  isBarcodeDuplicate, setIsBarcodeDuplicate,
}) => {
  const barcodeRef = useRef(null);
  const printRef = useRef(null);

  const { toast } = useToast();

  /**
   * Generates a barcode from the product name.
   * Uses Electron IPC to check if the barcode already exists.
   */
  const generateCodeBar = () => {
    if (!newProductData1.name) {
      JsBarcode(barcodeRef.current, 'Bar Code', {
        width: 1.2, // Adjust width based on label size --- good enough
        height: 28, // Adjust height based on label size
        displayValue: true,
        fontSize: 14, // Adjust font size dynamically   --- good enough
        textMargin: 1,
        margin: 0,
      });
      return;
    }

    try {
      window.electron.ipcRenderer.send("generateCodeBar", newProductData1.name);
      window.electron.ipcRenderer.once("generateCodeBar:response", (_, response) => {
        if (response.success) {
          setIsBarcodeDuplicate(false);
          const code = stringToNumericCode(newProductData1?.name);
          if (barcodeRef.current) {
            JsBarcode(barcodeRef.current, code, {
              format: "CODE128",
              lineColor: "#000",
              width: 1.2, // Adjust width based on label size --- good enough
              height: 28, // Adjust height based on label size
              displayValue: true,
              fontSize: 14, // Adjust font size dynamically   --- good enough
              textMargin: 1,
              margin: 0,
            });
            
            handleBarcodeGenerated(code)
          }
        } else {
          setIsBarcodeDuplicate(true);
          JsBarcode(barcodeRef.current, 'Bar Code', {
            width: 1.2, // Adjust width based on label size --- good enough
            height: 28, // Adjust height based on label size
            displayValue: true,
            fontSize: 14, // Adjust font size dynamically   --- good enough
            textMargin: 1,
            margin: 0,
          });
          toast({
            description: `The product name "${newProductData1.name}" already exists.`,
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("Error generating barcode:", error.message);
      JsBarcode(barcodeRef.current, 'Bar Code', {
        width: 1.2, // Adjust width based on label size --- good enough
        height: 28, // Adjust height based on label size
        displayValue: true,
        fontSize: 14, // Adjust font size dynamically   --- good enough
        textMargin: 1,
        margin: 0,
      });
    }
  };
  
  useEffect(() => {
    generateCodeBar();
  }, [newProductData1.name]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });
  return (
    <div className="flex flex-col gap-4 w-full">

      <Button
        type="button"
        className="flex gap-2"
        variant="outline"
        onClick={handlePrint}
        disabled={
                   isBarcodeDuplicate 
                || !newProductData1?.name?.trim() // Ensures the name field is not just empty spaces. 
                || !newProductData1?.price}
      >
        <Printer className="w-5" />
        <span>Print Barcode</span>
      </Button>

      <div ref={printRef} className="flex flex-col items-center">
        {newProductData1.price && <p className="text-center font-bold m-0 text-sm">{newProductData1.price} DA</p>}
        <svg ref={barcodeRef} className="barcode" />
      </div>
    </div>
  );
};

export default AddProductBarcodeGenerator;
