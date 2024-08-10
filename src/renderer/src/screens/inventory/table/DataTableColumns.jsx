/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
'use client'
import { ArrowUpDown, MoreHorizontal } from 'lucide-react'
import { Button } from '@shadcn-components/ui/button'
import { Checkbox } from '@shadcn-components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@shadcn-components/ui/dropdown-menu'
import EditProduct from '../EditProduct'
import { useContext } from 'react'
import ProductContext from '../../../context/ProductContext'
import { useToast } from '@shadcn-components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@shadcn-components/ui/dialog'
import { Label } from '@shadcn-components/ui/label'
import { Input } from '@shadcn-components/ui/input'
import { Link } from 'react-router-dom'

const DataTableColumns = () => {
  const columns = [
    {
      id: 'select',
      footer: (props) => props.column.id,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false
    },
    {
      accessorKey: 'name',
      footer: (props) => props.column.id,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <strong>{row.original?.name}</strong>
        </div>
      )
    },
    {
      accessorKey: 'barcode',
      footer: (props) => props.column.id,
      header: 'Barcode',
      cell: ({ row }) => <div className="capitalize">{row.original?.barcode}</div>
    },
    {
      accessorKey: 'quantity',
      footer: (props) => props.column.id,
      header: 'Quantity',
      cell: ({ row }) => <div className="capitalize">{row.original?.quantity}</div>
    },
    {
      accessorKey: 'category',
      footer: (props) => props.column.id,
      header: 'Category',
      cell: ({ row }) => {
        return <div className="capitalize">{row.original?.category?.name}</div>
      }
    },
    {
      accessorKey: 'brand',
      footer: (props) => props.column.id,
      header: 'Brand',
      cell: ({ row }) => {
        return <div className="capitalize">{row.original?.brand?.name}</div>
      }
    },
    {
      accessorKey: 'cost',
      footer: (props) => props.column.id,
      header: () => <div className="text-right">Product Cost</div>,
      cell: ({ row }) => {
        const price = parseFloat(row.original?.cost)
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'DZD'
        }).format(price)
        return <div className="text-right font-medium">{formatted}</div>
      }
    },
    {
      accessorKey: 'price',
      footer: (props) => props.column.id,
      header: () => <div className="text-right">Price</div>,
      cell: ({ row }) => {
        const price = parseFloat(row.original?.price)
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'DZD'
        }).format(price)
        return <div className="text-right font-medium">{formatted}</div>
      }
    },
    
    {
      id: 'actions',
      cell: ({ row }) => {
        const { deleteProductById } = useContext(ProductContext)
        const { toast } = useToast()
        const payment = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(payment.id)}>
                Copy payment ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link  to="edit-product" state={{ product: row?.original }}> Edit Product </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Dialog>
                  <DialogTrigger className=" w-full px-2 py-2 text-sm hover:bg-gray-100 transition-colors rounded-sm text-left">
                    Delete
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Are you absolutely sure?</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. This will permanently delete your product and
                        remove your data from the database.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          deleteProductById(row.original?.id)
                          toast({
                            description: 'Product Deleted successfully',
                            variant: 'success'
                          })
                        }}
                      >
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  return columns
}

export default DataTableColumns
