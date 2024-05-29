/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
/* eslint-disable react/jsx-no-undef */
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
  } from '@shadcn-components/ui/dialog'
  import { Button } from '@shadcn-components/ui/button'
  import { Label } from '@shadcn-components/ui/label'
  import { Input } from '@shadcn-components/ui/input'
  import { useToast } from '@shadcn-components/ui/use-toast'
import { useState } from 'react'

const EditeProduct = ({updateProductByIdFunc, setUpdateData, updateData, product}) => {
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const handleSubmit = (event)=>{
    event.preventDefault()
    updateProductByIdFunc(product?.id, updateData)
    setIsDialogOpen(false); // Close the dialog after successful update
    toast({description: "Product updated successfully.", variant: "success"})
  }
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="text-blue-500 transition-colors duration-200 dark:hover:text-indigo-500 dark:text-gray-300 hover:text-indigo-500 focus:outline-none"
        >
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:min-w-[800px]">
        <DialogHeader>
          <DialogTitle> Product Details</DialogTitle>
          <DialogDescription>
            Make changes to this profile here. Click save when you are done.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 py-4 "
        >
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product_name" className="text-right">
              Name
            </Label>
            <Input
              required
              type="text"
              id="product_name"
              defaultValue={product?.name}
              onChange={(event) =>
                setUpdateData((prevData) => ({ ...prevData, name: event.target.value }))
              }
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              type="number"
              id="quantity"
              defaultValue={product?.quantity}
              onChange={(event) =>
                setUpdateData((prevData) => ({ ...prevData, quantity: event.target.value }))
              }
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="purchasing_price" className="text-right">
              Purchasing Price
            </Label>
            <Input
              type="number"
              id="purchasing_price"
              defaultValue={product?.purchasing_price}
              onChange={(event) =>
                setUpdateData((prevData) => ({ ...prevData, purchasing_price: event.target.value }))
              }
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="selling_price" className="text-right">
              Selling Price
            </Label>
            <Input
              type="number"
              id="selling_price"
              defaultValue={product?.selling_price}
              onChange={(event) =>
                setUpdateData((prevData) => ({ ...prevData, selling_price: event.target.value }))
              }
              className="col-span-3"
            />
          </div>

          <DialogFooter>
            <Button className="mt-4" type="submit">
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditeProduct
