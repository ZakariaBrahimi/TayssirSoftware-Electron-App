/* eslint-disable prettier/prettier */
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import Barcode from 'react-barcode';

export default function AddProduct() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className='inline-flex items-center hover:text-white justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 mt-4' variant="outline">Add Product</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add a New Product</SheetTitle>
          <SheetDescription>
            {/* Make changes to your profile here. Click save when re done. */}
            Make a new product here. Click save when you are done.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
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
            <Input type='text' id="name" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="purchasing_price" className="text-right">
            Purchasing price
            </Label>
            <Input type="number" id="purchasing_price" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="selling_price" className="text-right">
            Selling price
            </Label>
            <Input type="number" id="selling_price" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input type="number" id="quantity" className="col-span-1" />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit">Save changes</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

