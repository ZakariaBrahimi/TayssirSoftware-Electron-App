/* eslint-disable prettier/prettier */
import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  Home,
  LineChart,
  Package,
  Package2,
  PanelLeft,
  // PlusCircle,
  Search,
  // Settings,
  ShoppingCart,
  Upload,
  Users2,
  Check,
  ChevronsUpDown,
} from 'lucide-react'

import { Badge } from '@shadcn-components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@shadcn-components/ui/breadcrumb'
import { Button } from '@shadcn-components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  // CardFooter,
  CardHeader,
  CardTitle
} from '@shadcn-components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shadcn-components/ui/dropdown-menu'
import { Input } from '@shadcn-components/ui/input'
import { Label } from '@shadcn-components/ui/label'
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue
// } from '@shadcn-components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@shadcn-components/ui/sheet'
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow
// } from '@shadcn-components/ui/table'
import { Textarea } from '@shadcn-components/ui/textarea'
// import { ToggleGroup, ToggleGroupItem } from '@shadcn-components/ui/toggle-group'
import { Popover, PopoverContent, PopoverTrigger } from '@shadcn-components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@shadcn-components/ui/command'

// import {
//   Tooltip,
//   TooltipContent,
//   TooltipTrigger,
// } from "@shadcn-components/ui/tooltip"
import ProductContext from '../../context/ProductContext'
// import product_placeholder from '../assets/product-placeholder'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import AddProductBarcodeGenerator from './AddProductBarcodeGenerator'

const Add = () => {
  const {
    createNewProduct,
    newProductData,
    setNewProductData,
    getCategories,
    categories,
    createNewCategory,
    newCategory,
    setNewCategory,

    brands,
    getProductBrands,
    createNewProductBrand,
    newBrand,
    setNewBrand
  } = useContext(ProductContext)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [brandsOpen, setBrandsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [brandValue, setBrandValue] = useState('')

  useEffect(() => {
    getCategories()
    getProductBrands()
    console.log(JSON.parse(localStorage.getItem('userSession')))
    setNewProductData((prevState) => ({ ...prevState, userId: JSON.parse(localStorage.getItem('userSession')).user.id}))
  }, [])
  
  
  const [productName, setProductName] = useState('')
  const [barcodePrice, setBarcodePrice] = useState(null);
  
  return (
    <div className="flex w-full flex-col sm:gap-4 sm:py-4 lg:ml-[16%]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs">
            <nav className="grid gap-6 text-lg font-medium">
              <Link
                to={'#'}
                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
              >
                <Package2 className="h-5 w-5 transition-all group-hover:scale-110" />
                <span className="sr-only">Acme Inc</span>
              </Link>
              <Link
                to={'#'}
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                <Home className="h-5 w-5" />
                Dashboard
              </Link>
              <Link
                to={'#'}
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                <ShoppingCart className="h-5 w-5" />
                Orders
              </Link>
              <Link to={'#'} className="flex items-center gap-4 px-2.5 text-foreground">
                <Package className="h-5 w-5" />
                Products
              </Link>
              <Link
                to={'#'}
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                <Users2 className="h-5 w-5" />
                Customers
              </Link>
              <Link
                to={'#'}
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                <LineChart className="h-5 w-5" />
                Settings
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <a href="/">Dashboard</a>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/inventory">Products</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit Product</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="relative ml-auto flex-1 md:grow-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
              <img
                src="/placeholder-user.jpg"
                width={36}
                height={36}
                alt="Avatar"
                className="overflow-hidden rounded-full"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <form
          onSubmit={createNewProduct}
          className="mx-auto grid max-w-[59rem] md:max-w-full flex-1 auto-rows-max gap-4"
        >
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/inventory')}
              variant="outline"
              size="icon"
              className="h-7 w-7"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              Pro Controller
            </h1>
            <Badge variant="outline" className="ml-auto sm:ml-0">
              In stock
            </Badge>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Button onClick={() => navigate('/inventory')} variant="outline" size="sm">
                Discard
              </Button>
              <Button type="submit" size="sm">
                Save Product
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
            <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
              <Card x-chunk="dashboard-07-chunk-0">
                <CardHeader>
                  <CardTitle>Product Details</CardTitle>
                  <CardDescription>
                    Lipsum dolor sit amet, consectetur adipiscing elit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div className="grid gap-3">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        required
                        value={newProductData?.name}
                        id="name"
                        type="text"
                        onChange={(e) =>{
                          setNewProductData((prevState) => ({ ...prevState, name: e.target.value }))
                          setProductName(e.target.value)
                        }}
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="codeBar">Code Bar</Label>
                      
                      <AddProductBarcodeGenerator type={'addProduct'} setProductName={setProductName} productName={productName} barcodePrice={barcodePrice} setProductData={setNewProductData} productData={newProductData}  />
                    </div>

                    <div className="grid gap-3">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        required
                        id="description"
                        defaultValue="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl nec ultricies ultricies, nunc nisl ultricies nunc, nec ultricies nunc nisl nec nunc."
                        className="min-h-32"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="grid gap-3 flex-1">
                        <Label htmlFor="cost">Product Cost</Label>
                        <Input
                          required
                          value={newProductData?.cost}
                          onChange={(e) =>
                            setNewProductData((prevState) => ({
                              ...prevState,
                              cost: e.target.value
                            }))
                          }
                          type="number"
                          id="cost"
                          className="w-full"
                        />
                      </div>
                      <div className="grid gap-3 flex-1">
                        <Label htmlFor="price">Price</Label>
                        <Input
                          required
                          value={newProductData?.price}
                          onChange={(e) => {
                            setNewProductData((prevState) => ({
                              ...prevState,
                              price: e.target.value
                            }));
                            setBarcodePrice(e.target.value);
                          }}
                          
                          type="number"
                          id="price"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        required
                        value={newProductData?.quantity}
                        onChange={(e) =>
                          setNewProductData((prevState) => ({
                            ...prevState,
                            quantity: e.target.value
                          }))
                        }
                        id="quantity"
                        type="number"
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-6 sm:grid-cols-4">
                      <div className="grid gap-3 sm:col-span-2">
                        <Label className="" htmlFor="category">
                          Category
                        </Label>
                        <Popover className="bg-yellow-400" open={open} onOpenChange={setOpen}>
                          <PopoverTrigger className="bg-blue-4" asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={open}
                              className="w-full justify-between"
                            >
                              {value
                                ? categories.find((category) => category.dataValues.name === value)
                                    ?.dataValues.name
                                : 'Select Category...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0">
                            <Command className="w-full">
                              <CommandInput
                                className="w-full bg-green-20"
                                placeholder="Search or Create Category..."
                              />
                              <CommandList>
                                <CommandEmpty className="flex gap-2 items-center justify-evenly my-3">
                                  <span>No Category found.</span>
                                  <Sheet>
                                    <SheetTrigger asChild>
                                      <Button variant="outline">Create Category</Button>
                                    </SheetTrigger>
                                    <SheetContent>
                                      <SheetHeader>
                                        <SheetTitle>Create A New Category</SheetTitle>
                                        <SheetDescription>
                                          Make changes to your Categories List here. Click save when
                                          you are done.
                                        </SheetDescription>
                                      </SheetHeader>
                                      <div className="grid gap-4 py-4">
                                        <div className="flex flex-col justify-center items-start gap-4 mt-2">
                                          <Label htmlFor="category_name" className="text-right">
                                            Category Name
                                          </Label>
                                          <Input
                                            id="category_name"
                                            value={newCategory}
                                            onChange={(event) => setNewCategory(event.target.value)}
                                            className="col-span-3"
                                          />
                                        </div>
                                      </div>
                                      <SheetFooter>
                                        <SheetClose asChild>
                                          <Button
                                            type="button"
                                            onClick={() => createNewCategory(newCategory)}
                                          >
                                            Save changes
                                          </Button>
                                        </SheetClose>
                                      </SheetFooter>
                                    </SheetContent>
                                  </Sheet>
                                </CommandEmpty>
                                <CommandGroup>
                                  {categories.length > 0 &&
                                    categories.map((category) => (
                                      <CommandItem
                                        key={category.dataValues.id}
                                        onSelect={(currentValue) => {
                                          setValue(currentValue === value ? '' : currentValue)
                                          setOpen(false)
                                          setNewProductData((prevState) => ({
                                            ...prevState,
                                            categoryId: category?.dataValues?.id
                                          }))
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            'mr-2 h-4 w-4',
                                            value === category.dataValues.name
                                              ? 'opacity-100'
                                              : 'opacity-0'
                                          )}
                                        />
                                        {category.dataValues.name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        
                      </div>
                      <div className="grid gap-3 sm:col-span-2">
                        <Label htmlFor="brands">Brand Name (optional)</Label>
                        <Popover
                          className="bg-yellow-400"
                          open={brandsOpen}
                          onOpenChange={setBrandsOpen}
                        >
                          <PopoverTrigger className="bg-blue-4" asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={brandsOpen}
                              className="w-full justify-between"
                            >
                              {brandValue
                                ? brands.find((brand) => brand.dataValues.name === brandValue)
                                    ?.dataValues.name
                                : 'Select Brand...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0">
                            <Command className="w-full">
                              <CommandInput
                                className="w-full bg-green-20"
                                placeholder="Search or Create Brand..."
                              />
                              <CommandList>
                                <CommandEmpty className="flex gap-2 items-center justify-evenly my-3">
                                  <span>No Brand found.</span>
                                  <Sheet>
                                    <SheetTrigger asChild>
                                      <Button variant="outline">Create Brand</Button>
                                    </SheetTrigger>
                                    <SheetContent>
                                      <SheetHeader>
                                        <SheetTitle>Create A New Brand</SheetTitle>
                                        <SheetDescription>
                                          Make changes to your Brands List here. Click save when you
                                          are done.
                                        </SheetDescription>
                                      </SheetHeader>
                                      <div className="grid gap-4 py-4">
                                        <div className="flex flex-col justify-center items-start gap-4 mt-2">
                                          <Label htmlFor="brand_name" className="text-right">
                                            Brand Name
                                          </Label>
                                          <Input
                                            id="brand_name"
                                            value={newBrand}
                                            onChange={(event) => setNewBrand(event.target.value)}
                                            className="col-span-3"
                                          />
                                        </div>
                                      </div>
                                      <SheetFooter>
                                        <SheetClose asChild>
                                          <Button
                                            type="button"
                                            onClick={() => createNewProductBrand(newBrand)}
                                          >
                                            Save changes
                                          </Button>
                                        </SheetClose>
                                      </SheetFooter>
                                    </SheetContent>
                                  </Sheet>
                                </CommandEmpty>
                                <CommandGroup>
                                  {brands.length > 0 &&
                                    brands.map((brand) => (
                                      <CommandItem
                                        key={brand.dataValues.id}
                                        onSelect={(currentValue) => {
                                          setBrandValue(
                                            currentValue === brandValue ? '' : currentValue
                                          )
                                          setBrandsOpen(false)
                                          setNewProductData((prevState) => ({
                                            ...prevState,
                                            brandId: brand?.dataValues?.id
                                          }))
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            'mr-2 h-4 w-4',
                                            brandValue === brand.dataValues.name
                                              ? 'opacity-100'
                                              : 'opacity-0'
                                          )}
                                        />
                                        {brand.dataValues.name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* <Card x-chunk="dashboard-07-chunk-2">
                <CardHeader>
                  <CardTitle>Product Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-3">
                    <div className="grid gap-3">
                      <Label htmlFor="category">Category</Label>
                      <Select>
                        <SelectTrigger id="category" aria-label="Select category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clothing">Clothing</SelectItem>
                          <SelectItem value="electronics">Electronics</SelectItem>
                          <SelectItem value="accessories">Accessories</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="subcategory">Subcategory (optional)</Label>
                      <Select>
                        <SelectTrigger id="subcategory" aria-label="Select subcategory">
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="t-shirts">T-Shirts</SelectItem>
                          <SelectItem value="hoodies">Hoodies</SelectItem>
                          <SelectItem value="sweatshirts">Sweatshirts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card> */}
              {/* <Card x-chunk="dashboard-07-chunk-1">
                  <CardHeader>
                    <CardTitle>Stock</CardTitle>
                    <CardDescription>
                      Lipsum dolor sit amet, consectetur adipiscing elit
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">SKU</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead className="w-[100px]">Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-semibold">
                            GGPC-001
                          </TableCell>
                          <TableCell>
                            <Label htmlFor="stock-1" className="sr-only">
                              Stock
                            </Label>
                            <Input
                              id="stock-1"
                              type="number"
                              defaultValue="100"
                            />
                          </TableCell>
                          <TableCell>
                            <Label htmlFor="price-1" className="sr-only">
                              Price
                            </Label>
                            <Input
                              id="price-1"
                              type="number"
                              defaultValue="99.99"
                            />
                          </TableCell>
                          <TableCell>
                            <ToggleGroup
                              type="single"
                              defaultValue="s"
                              variant="outline"
                            >
                              <ToggleGroupItem value="s">S</ToggleGroupItem>
                              <ToggleGroupItem value="m">M</ToggleGroupItem>
                              <ToggleGroupItem value="l">L</ToggleGroupItem>
                            </ToggleGroup>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">
                            GGPC-002
                          </TableCell>
                          <TableCell>
                            <Label htmlFor="stock-2" className="sr-only">
                              Stock
                            </Label>
                            <Input
                              id="stock-2"
                              type="number"
                              defaultValue="143"
                            />
                          </TableCell>
                          <TableCell>
                            <Label htmlFor="price-2" className="sr-only">
                              Price
                            </Label>
                            <Input
                              id="price-2"
                              type="number"
                              defaultValue="99.99"
                            />
                          </TableCell>
                          <TableCell>
                            <ToggleGroup
                              type="single"
                              defaultValue="m"
                              variant="outline"
                            >
                              <ToggleGroupItem value="s">S</ToggleGroupItem>
                              <ToggleGroupItem value="m">M</ToggleGroupItem>
                              <ToggleGroupItem value="l">L</ToggleGroupItem>
                            </ToggleGroup>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">
                            GGPC-003
                          </TableCell>
                          <TableCell>
                            <Label htmlFor="stock-3" className="sr-only">
                              Stock
                            </Label>
                            <Input
                              id="stock-3"
                              type="number"
                              defaultValue="32"
                            />
                          </TableCell>
                          <TableCell>
                            <Label htmlFor="price-3" className="sr-only">
                              Stock
                            </Label>
                            <Input
                              id="price-3"
                              type="number"
                              defaultValue="99.99"
                            />
                          </TableCell>
                          <TableCell>
                            <ToggleGroup
                              type="single"
                              defaultValue="s"
                              variant="outline"
                            >
                              <ToggleGroupItem value="s">S</ToggleGroupItem>
                              <ToggleGroupItem value="m">M</ToggleGroupItem>
                              <ToggleGroupItem value="l">L</ToggleGroupItem>
                            </ToggleGroup>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="justify-center border-t p-4">
                    <Button size="sm" variant="ghost" className="gap-1">
                      <PlusCircle className="h-3.5 w-3.5" />
                      Add Variant
                    </Button>
                  </CardFooter>
                </Card> */}
            </div>
            <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
              {/* <Card x-chunk="dashboard-07-chunk-3">
                  <CardHeader>
                    <CardTitle>Product Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6">
                      <div className="grid gap-3">
                        <Label htmlFor="status">Status</Label>
                        <Select>
                          <SelectTrigger id="status" aria-label="Select status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card> */}
              <Card className="overflow-hidden" x-chunk="dashboard-07-chunk-4">
                <CardHeader>
                  <CardTitle>Product Images</CardTitle>
                  <CardDescription>
                    Lipsum dolor sit amet, consectetur adipiscing elit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" fill="none">
                      <rect width="1200" height="1200" fill="#EAEAEA" rx="3" />
                      <g opacity=".5">
                        <g opacity=".5">
                          <path
                            fill="#FAFAFA"
                            d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"
                          />
                          <path
                            stroke="#C9C9C9"
                            strokeWidth="2.418"
                            d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"
                          />
                        </g>
                        <path
                          stroke="url(#a)"
                          strokeWidth="2.418"
                          d="M0-1.209h553.581"
                          transform="scale(1 -1) rotate(45 1163.11 91.165)"
                        />
                        <path stroke="url(#b)" strokeWidth="2.418" d="M404.846 598.671h391.726" />
                        <path stroke="url(#c)" strokeWidth="2.418" d="M599.5 795.742V404.017" />
                        <path
                          stroke="url(#d)"
                          strokeWidth="2.418"
                          d="m795.717 796.597-391.441-391.44"
                        />
                        <path
                          fill="#fff"
                          d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"
                        />
                        <g clipPath="url(#e)">
                          <path
                            fill="#666"
                            fillRule="evenodd"
                            d="M616.426 586.58h-31.434v16.176l3.553-3.554.531-.531h9.068l.074-.074 8.463-8.463h2.565l7.18 7.181V586.58Zm-15.715 14.654 3.698 3.699 1.283 1.282-2.565 2.565-1.282-1.283-5.2-5.199h-6.066l-5.514 5.514-.073.073v2.876a2.418 2.418 0 0 0 2.418 2.418h26.598a2.418 2.418 0 0 0 2.418-2.418v-8.317l-8.463-8.463-7.181 7.181-.071.072Zm-19.347 5.442v4.085a6.045 6.045 0 0 0 6.046 6.045h26.598a6.044 6.044 0 0 0 6.045-6.045v-7.108l1.356-1.355-1.282-1.283-.074-.073v-17.989h-38.689v23.43l-.146.146.146.147Z"
                            clipRule="evenodd"
                          />
                        </g>
                        <path
                          stroke="#C9C9C9"
                          strokeWidth="2.418"
                          d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"
                        />
                      </g>
                      <defs>
                        <linearGradient
                          id="a"
                          x1="554.061"
                          x2="-.48"
                          y1=".083"
                          y2=".087"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop stopColor="#C9C9C9" stopOpacity="0" />
                          <stop offset=".208" stopColor="#C9C9C9" />
                          <stop offset=".792" stopColor="#C9C9C9" />
                          <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient
                          id="b"
                          x1="796.912"
                          x2="404.507"
                          y1="599.963"
                          y2="599.965"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop stopColor="#C9C9C9" stopOpacity="0" />
                          <stop offset=".208" stopColor="#C9C9C9" />
                          <stop offset=".792" stopColor="#C9C9C9" />
                          <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient
                          id="c"
                          x1="600.792"
                          x2="600.794"
                          y1="403.677"
                          y2="796.082"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop stopColor="#C9C9C9" stopOpacity="0" />
                          <stop offset=".208" stopColor="#C9C9C9" />
                          <stop offset=".792" stopColor="#C9C9C9" />
                          <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient
                          id="d"
                          x1="404.85"
                          x2="796.972"
                          y1="403.903"
                          y2="796.02"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop stopColor="#C9C9C9" stopOpacity="0" />
                          <stop offset=".208" stopColor="#C9C9C9" />
                          <stop offset=".792" stopColor="#C9C9C9" />
                          <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                        </linearGradient>
                        <clipPath id="e">
                          <path fill="#fff" d="M581.364 580.535h38.689v38.689h-38.689z" />
                        </clipPath>
                      </defs>
                    </svg>
                    <div className="grid grid-cols-3 gap-2">
                      <button>
                        <svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" fill="none">
                          <rect width="1200" height="1200" fill="#EAEAEA" rx="3" />
                          <g opacity=".5">
                            <g opacity=".5">
                              <path
                                fill="#FAFAFA"
                                d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"
                              />
                              <path
                                stroke="#C9C9C9"
                                strokeWidth="2.418"
                                d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"
                              />
                            </g>
                            <path
                              stroke="url(#a)"
                              strokeWidth="2.418"
                              d="M0-1.209h553.581"
                              transform="scale(1 -1) rotate(45 1163.11 91.165)"
                            />
                            <path
                              stroke="url(#b)"
                              strokeWidth="2.418"
                              d="M404.846 598.671h391.726"
                            />
                            <path stroke="url(#c)" strokeWidth="2.418" d="M599.5 795.742V404.017" />
                            <path
                              stroke="url(#d)"
                              strokeWidth="2.418"
                              d="m795.717 796.597-391.441-391.44"
                            />
                            <path
                              fill="#fff"
                              d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"
                            />
                            <g clipPath="url(#e)">
                              <path
                                fill="#666"
                                fillRule="evenodd"
                                d="M616.426 586.58h-31.434v16.176l3.553-3.554.531-.531h9.068l.074-.074 8.463-8.463h2.565l7.18 7.181V586.58Zm-15.715 14.654 3.698 3.699 1.283 1.282-2.565 2.565-1.282-1.283-5.2-5.199h-6.066l-5.514 5.514-.073.073v2.876a2.418 2.418 0 0 0 2.418 2.418h26.598a2.418 2.418 0 0 0 2.418-2.418v-8.317l-8.463-8.463-7.181 7.181-.071.072Zm-19.347 5.442v4.085a6.045 6.045 0 0 0 6.046 6.045h26.598a6.044 6.044 0 0 0 6.045-6.045v-7.108l1.356-1.355-1.282-1.283-.074-.073v-17.989h-38.689v23.43l-.146.146.146.147Z"
                                clipRule="evenodd"
                              />
                            </g>
                            <path
                              stroke="#C9C9C9"
                              strokeWidth="2.418"
                              d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"
                            />
                          </g>
                          <defs>
                            <linearGradient
                              id="a"
                              x1="554.061"
                              x2="-.48"
                              y1=".083"
                              y2=".087"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient
                              id="b"
                              x1="796.912"
                              x2="404.507"
                              y1="599.963"
                              y2="599.965"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient
                              id="c"
                              x1="600.792"
                              x2="600.794"
                              y1="403.677"
                              y2="796.082"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient
                              id="d"
                              x1="404.85"
                              x2="796.972"
                              y1="403.903"
                              y2="796.02"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <clipPath id="e">
                              <path fill="#fff" d="M581.364 580.535h38.689v38.689h-38.689z" />
                            </clipPath>
                          </defs>
                        </svg>
                        {/* <img
                            alt="Product image"
                            className="aspect-square w-full rounded-md object-cover"
                            height="84"
                            src={'product_placeholder'}
                            width="84"
                          /> */}
                      </button>
                      <button>
                        <svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" fill="none">
                          <rect width="1200" height="1200" fill="#EAEAEA" rx="3" />
                          <g opacity=".5">
                            <g opacity=".5">
                              <path
                                fill="#FAFAFA"
                                d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"
                              />
                              <path
                                stroke="#C9C9C9"
                                strokeWidth="2.418"
                                d="M600.709 736.5c-75.454 0-136.621-61.167-136.621-136.62 0-75.454 61.167-136.621 136.621-136.621 75.453 0 136.62 61.167 136.62 136.621 0 75.453-61.167 136.62-136.62 136.62Z"
                              />
                            </g>
                            <path
                              stroke="url(#a)"
                              strokeWidth="2.418"
                              d="M0-1.209h553.581"
                              transform="scale(1 -1) rotate(45 1163.11 91.165)"
                            />
                            <path
                              stroke="url(#b)"
                              strokeWidth="2.418"
                              d="M404.846 598.671h391.726"
                            />
                            <path stroke="url(#c)" strokeWidth="2.418" d="M599.5 795.742V404.017" />
                            <path
                              stroke="url(#d)"
                              strokeWidth="2.418"
                              d="m795.717 796.597-391.441-391.44"
                            />
                            <path
                              fill="#fff"
                              d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"
                            />
                            <g clipPath="url(#e)">
                              <path
                                fill="#666"
                                fillRule="evenodd"
                                d="M616.426 586.58h-31.434v16.176l3.553-3.554.531-.531h9.068l.074-.074 8.463-8.463h2.565l7.18 7.181V586.58Zm-15.715 14.654 3.698 3.699 1.283 1.282-2.565 2.565-1.282-1.283-5.2-5.199h-6.066l-5.514 5.514-.073.073v2.876a2.418 2.418 0 0 0 2.418 2.418h26.598a2.418 2.418 0 0 0 2.418-2.418v-8.317l-8.463-8.463-7.181 7.181-.071.072Zm-19.347 5.442v4.085a6.045 6.045 0 0 0 6.046 6.045h26.598a6.044 6.044 0 0 0 6.045-6.045v-7.108l1.356-1.355-1.282-1.283-.074-.073v-17.989h-38.689v23.43l-.146.146.146.147Z"
                                clipRule="evenodd"
                              />
                            </g>
                            <path
                              stroke="#C9C9C9"
                              strokeWidth="2.418"
                              d="M600.709 656.704c-31.384 0-56.825-25.441-56.825-56.824 0-31.384 25.441-56.825 56.825-56.825 31.383 0 56.824 25.441 56.824 56.825 0 31.383-25.441 56.824-56.824 56.824Z"
                            />
                          </g>
                          <defs>
                            <linearGradient
                              id="a"
                              x1="554.061"
                              x2="-.48"
                              y1=".083"
                              y2=".087"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient
                              id="b"
                              x1="796.912"
                              x2="404.507"
                              y1="599.963"
                              y2="599.965"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient
                              id="c"
                              x1="600.792"
                              x2="600.794"
                              y1="403.677"
                              y2="796.082"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient
                              id="d"
                              x1="404.85"
                              x2="796.972"
                              y1="403.903"
                              y2="796.02"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#C9C9C9" stopOpacity="0" />
                              <stop offset=".208" stopColor="#C9C9C9" />
                              <stop offset=".792" stopColor="#C9C9C9" />
                              <stop offset="1" stopColor="#C9C9C9" stopOpacity="0" />
                            </linearGradient>
                            <clipPath id="e">
                              <path fill="#fff" d="M581.364 580.535h38.689v38.689h-38.689z" />
                            </clipPath>
                          </defs>
                        </svg>
                      </button>
                      <button className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="sr-only">Upload</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* <Card x-chunk="dashboard-07-chunk-5">
                  <CardHeader>
                    <CardTitle>Archive Product</CardTitle>
                    <CardDescription>
                      Lipsum dolor sit amet, consectetur adipiscing elit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div></div>
                    <Button size="sm" variant="secondary">
                      Archive Product
                    </Button>
                  </CardContent>
                </Card> */}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 md:hidden">
            <Button onClick={() => navigate('/inventory')} variant="outline" size="sm">
              Discard
            </Button>
            <Button type="submit" size="sm">
              Save Product
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default Add
