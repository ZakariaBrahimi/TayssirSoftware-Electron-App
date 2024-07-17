/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { Button } from '@shadcn-components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@shadcn-components/ui/dialog'
import { Input } from '@shadcn-components/ui/input'
import { Label } from '@shadcn-components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shadcn-components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@shadcn-components/ui/card'
import { Check, ChevronsUpDown, BadgeX } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@shadcn-components/ui/table'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@shadcn-components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@shadcn-components/ui/popover'
import { useContext, useEffect, useState } from 'react'
import ProductContext from '../../context/ProductContext'
import SalesContext from '../../context/SalesContext'
import { BarcodeScanner } from 'react-barcode-scanner'
import "react-barcode-scanner/polyfill"

const NewProductSell = () => {
  const { products } = useContext(ProductContext)
  const { newSoldProducts } = useContext(SalesContext)
  // State to manage whether the select element (dropdown) is open or closed
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  // State to manage whether a dialog is open or closed
  const [dialogIsOpen, setDialogIsOpen] = useState(false)
  const [soldProducts, setSoldProducts] = useState([]) // [{product: product_1, quantity: 1, discount:0}, ]

  // Function to handle selecting a product from the dropdown
  const handleSelect = (product) => {
    // Adding the selected product to the sold Products list with the initial discount(0) and initial quantity(1)
    // Looks for an item in soldProducts that has the same id as product. It returns the item if a match is found and undefined otherwise.
    if (!soldProducts.find(soldProduct => soldProduct.product.id === product.id)) {
      setSoldProducts(prev => [...prev, { product: product, quantity: 1, discount: 0 }]);
    } else {
      setSoldProducts(prev => 
        prev.map(soldProduct => 
          soldProduct.product.id === product.id 
            ? { ...soldProduct, quantity: soldProduct.quantity + 1 } 
            : soldProduct
        )
      );
    }
    // Close the the select dropdown
    setIsSelectOpen(false)
  }
  // Function to handle deleting a product from sold Products
  const handleDelete = (currentProduct) => {
    setSoldProducts((prev) => 
      prev.filter(product => currentProduct.product.id !== product.product.id)
    );
  }
  const handleProductQuantityChange = (currentProduct, event) => {
    const newQuantity = parseInt(event.target.value, 10); // Ensure the value is an integer
    setSoldProducts((prev) => 
        prev.map(product => {
            if (currentProduct.product.id === product.product.id) {
                return { ...product, quantity: newQuantity };
            } else {
                return product;
            }
        })
    );
}
  const handleProductDiscountChange = (currentProduct, event) => {
    const currentDiscount = parseInt(event.target.value, 10); // Ensure the value is an integer
    setSoldProducts((prev) => 
        prev.map(product => {
            if (currentProduct.product.id === product.product.id) {
                return { ...product, discount: currentDiscount };
            } else {
                return product;
            }
        })
    );
}
  // Fucntion to get the total net profit
  const getTotalNetProfit = () => {
    let total = 0
    soldProducts.forEach((product) => {
      total += (product?.product?.price - product?.product?.cost - product?.discount)*product?.quantity
    })
    return total
  }
  useEffect(() => {
    console.log("soldProducts: ", soldProducts)
  }, [soldProducts])
  return (
    <Dialog open={dialogIsOpen} onOpenChange={setDialogIsOpen}>
      <DialogTrigger asChild>
        <Button>Sell a Product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[925px]">
          <DialogHeader>
            <DialogTitle>Product Selling</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you are done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Tabs defaultValue="Barcode" className="col-span-4">
                <TabsList className="min-w-full">
                  <TabsTrigger className="w-full" value="Barcode">
                    Barcode
                  </TabsTrigger>
                  <TabsTrigger className="w-full" value="Name">
                    Name
                  </TabsTrigger>
                </TabsList>
                <TabsContent className="mt-0 mb-6" value="Barcode">
                  <span className="font-semibold opacity-80 text-sm mt-0 ml-2">
                    Searching for a Product by the Barcode.
                  </span>
                  <Input className="mt-8" type="number" placeholder="Product Barcode" />
                  {/* <BarcodeScanner /> */}
                </TabsContent>
                <TabsContent className="mt-4 mb-6" value="Name">
                  <div className="grid gap-3 sm:col-span-2">
                    <Label htmlFor="products">Product Name (optional)</Label>
                    <Popover open={isSelectOpen} onOpenChange={setIsSelectOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isSelectOpen}
                          className="w-full justify-between"
                        >
                          Search Product By Name...
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[870px] p-0">
                        <Command className="w-full">
                          <CommandInput
                            className="w-full bg-green-20"
                            placeholder="Search Product By Name..."
                          />
                          <CommandList>
                            <CommandEmpty className="flex gap-2 items-center justify-evenly my-3">
                              <span>No Product with this name.</span>
                            </CommandEmpty>
                            <CommandGroup>
                              {products.length > 0 &&
                                products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    onSelect={() => handleSelect(product)}
                                  >
                                    {/* <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        selectedProduct && selectedProduct.id === product.id
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    /> */}
                                    <div className="flex w-full justify-between pr-8 font-semibold">
                                      <span>{product.name}</span>
                                      <span>{product.cost}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <main className="grid flex-1 items-start gap-4 py-4 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
              <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-3">
                <Card x-chunk="dashboard-05-chunk-3">
                  <CardHeader className="px-7">
                    <CardTitle>Sold Products</CardTitle>
                    <CardDescription>Recent orders from your store.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {soldProducts.length !== 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-center">Cost</TableHead>
                            <TableHead className="text-center">Price</TableHead>
                            <TableHead className="text-center">Discount</TableHead>
                            <TableHead className="text-center">Quantity</TableHead>
                            {/* <TableHead className="text-center">Total</TableHead> */}
                            <TableHead className="text-center">Net Profit </TableHead>
                            <TableHead className="text-center"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {soldProducts.map((soldProduct) => (
                            <TableRow
                              key={soldProduct?.product?.id}
                              className="hover:bg-accent font-semibold cursor-pointer"
                            >
                              <TableCell>
                                <div className="font-medium">{soldProduct?.product?.name}</div>
                              </TableCell>
                              <TableCell className="text-center">{soldProduct?.product?.cost}</TableCell>
                              <TableCell className="text-center">{soldProduct?.product?.price} </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  className="w-fit outline-none border-2"
                                  type="number"
                                  value={soldProduct?.discount}
                                  onChange={(event) => handleProductDiscountChange(soldProduct, event)}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" value={soldProduct?.quantity} onChange={(event)=>handleProductQuantityChange(soldProduct, event)} />
                              </TableCell>
                              <TableCell className="text-center text-green-500 font-semibold">
                                {(soldProduct?.product?.price - soldProduct?.product?.cost - soldProduct?.discount)*soldProduct?.quantity }
                              </TableCell>
                              <TableCell className="text-center text-red-600">
                                <Button onClick={() => handleDelete(soldProduct)} variant="ghost">
                                  <BadgeX />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p>There are no Products here</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <div className="flex gap-8 font-semibold">
                <h1>Total Profits: {getTotalNetProfit()}</h1>
                <h1>Total Products: {soldProducts.length} </h1>
                {/* <h1>Total Profits: </h1> */}
              </div>
              <Button onClick={()=>newSoldProducts(soldProducts, setDialogIsOpen)} type="button">Sold</Button>
            </div>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default NewProductSell
