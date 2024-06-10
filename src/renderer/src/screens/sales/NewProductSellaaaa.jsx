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
import { MoreHorizontal, Check, ChevronsUpDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shadcn-components/ui/dropdown-menu'
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

const NewProductSell = () => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [transactions, setTransactions] = useState([])
  const { products } = useContext(ProductContext)

  const handleSelect = (currentValue) => {
    try {
      const productData = products.find((product) => product.name === currentValue.name)
      setValue(productData || null)
      setOpen(false)
      setTransactions((prev)=>({...prev, value}))

    } catch (error) {
      console.error('Error parsing product data:', error)
    }
  }
useEffect(() => {
  // Check if the value already exists in transactions
  const exists = transactions != null ? transactions.some((product) => product.id === value.id) : false
  if (!exists && value) {
    // Add the new transaction value to the transactions list
    setTransactions((prev) => [...prev, value]);
  }

  console.log('Transactions changed:', transactions);
}, [value]);
  return (
    <Dialog>
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
              </TabsContent>
              <TabsContent className="mt-4 mb-6" value="Name">
                <div className="grid gap-3 sm:col-span-2">
                  <Label htmlFor="products">Product Name (optional)</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                      >
                        {value ? value?.name : 'Search Product By Name...eee'}
                        {/* {value
                          ? products.find((product) => product === value).name
                          : 'Search Product By Name...eee'} */}
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
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      value && value.id === product.id ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                  <div className="flex w-full justify-between pr-8 font-semibold">
                                    <span>{product.name}</span>
                                    <span>{product.purchasing_price}</span>
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
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>Recent orders from your store.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-center">Cost</TableHead>
                        <TableHead className="text-center">Discount</TableHead>
                        <TableHead className="text-center">Price</TableHead>
                        <TableHead className="text-center">Net Profit</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="hover:bg-accent font-semibold cursor-pointer">
                        <TableCell>
                          <div className="font-medium">Product Name</div>
                        </TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center text-green-500 font-semibold">
                          250.00 DA
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText('payment.id')}
                              >
                                Copy payment ID
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>View customer</DropdownMenuItem>
                              <DropdownMenuItem>View payment details</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-accent font-semibold cursor-pointer">
                        <TableCell>
                          <div className="font-medium">Product Name</div>
                        </TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center text-green-500 font-semibold">
                          250.00 DA
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText('payment.id')}
                              >
                                Copy payment ID
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>View customer</DropdownMenuItem>
                              <DropdownMenuItem>View payment details</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-accent font-semibold cursor-pointer">
                        <TableCell>
                          <div className="font-medium">Product Name</div>
                        </TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center">250.00 DA</TableCell>
                        <TableCell className="text-center text-green-500 font-semibold">
                          250.00 DA
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText('payment.id')}
                              >
                                Copy payment ID
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>View customer</DropdownMenuItem>
                              <DropdownMenuItem>View payment details</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default NewProductSell
