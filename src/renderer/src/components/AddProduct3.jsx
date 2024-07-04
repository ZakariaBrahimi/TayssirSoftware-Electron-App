/* eslint-disable prettier/prettier */
import { Button } from '@shadcn-components/ui/button'
import { Input } from '@shadcn-components/ui/input'
import { Label } from '@shadcn-components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@shadcn-components/ui/sheet'
import Barcode from 'react-barcode'
import { useContext } from 'react'
import ProductContext from '../context/ProductContext';

export default function AddProduct() {
  
  const {createNewProduct, newProductData, setNewProductData } = useContext(ProductContext)
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className="inline-flex items-center hover:text-white justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 mt-4"
          variant="outline"
        >
          Add Product
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add a New Product</SheetTitle>
          <SheetDescription>
            {/* Make changes to your profile here. Click save when re done. */}
            Make a new product here. Click save when you are done.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={createNewProduct} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            {/* <Barcode format='MSI' value="HELLOWORLD" /> */}

            <Label htmlFor="code_bar" className="text-right">
              Code Bar
            </Label>
            <Barcode value="GHFGHFG" format="CODE128" width={2} height={100} />
            {/* <Input type='number' id="code_bar" className="col-span-3" /> */}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              value={newProductData?.name}
              onChange={(e) =>
                setNewProductData((prevState) => ({ ...prevState, name: e.target.value }))
              }
              type="text"
              id="name"
              required
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cost" className="text-right">
              Purchasing price
            </Label>
            <Input
              value={newProductData?.cost}
              onChange={(e) =>
                setNewProductData((prevState) => ({
                  ...prevState,
                  cost: e.target.value
                }))
              }
              type="number"
              id="cost"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Selling price
            </Label>
            <Input
              value={newProductData?.price}
              onChange={(e) =>
                setNewProductData((prevState) => ({ ...prevState, price: e.target.value }))
              }
              type="number"
              id="price"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              value={newProductData?.quantity}
              onChange={(e) =>
                setNewProductData((prevState) => ({ ...prevState, quantity: e.target.value }))
              }
              type="number"
              id="quantity"
              className="col-span-1"
            />
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="submit">Save changes</Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
