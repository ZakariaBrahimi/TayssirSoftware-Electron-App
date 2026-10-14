/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
/* eslint-disable react/jsx-no-undef */

import { Button } from '@shadcn-components/ui/button'
import { Input } from '@shadcn-components/ui/input'

/* eslint-disable prettier/prettier */
import { useContext, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  LineChart,
  Package,
  Package2,
  PanelLeft,
  Search,
  ShoppingCart,
  Users2,
  
} from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@shadcn-components/ui/breadcrumb'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shadcn-components/ui/dropdown-menu'

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  
} from '@shadcn-components/ui/sheet'



import ProductContext from '../../context/ProductContext'
import ProductForm from './ProductForm'

const EditProduct = () => {
  const {
    updateProductById,
    // setUpdateData,
    getCategories,
    getProductBrands,
    // updateData,
  } = useContext(ProductContext)
  const location = useLocation()
  const { product } = location.state
  
  useEffect(() => {
    getCategories()
    getProductBrands()
    console.log('Default/Existing Product Data', product)
    // setUpdateData(product);
    // console.log('jjjjjjjjjjjjjjjjjjj', updateData)
  }, [])
const handleSubmit = (data) => {
  // data: the new updated data passed automatically by reactFormHook
    console.log('Updated Product Data', data)
    updateProductById(product.id, data); // The first argument is fixed id, will not change, the second one is data, which will change based on user preferences
  };
  
  return (
    <div className="flex w-full flex-col sm:gap-4 sm:py-4 sm:pl lg:ml-[16%]">
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
      <ProductForm onSubmit={handleSubmit} initialData={product} />
      </main>
    </div>
  )
}

export default EditProduct




