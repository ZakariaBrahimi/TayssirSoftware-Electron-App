/* eslint-disable prettier/prettier */

/* eslint-disable prettier/prettier */
import { Link } from 'react-router-dom'
import  DataTable from './table/DataTable'

const Inventory = () => {
  return (
    <div className="flex flex-col w-full">
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold md:text-2xl">Inventory</h1>
        <Link to='add-new-product' className={'inline-flex items-center hover:text-white justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 mt-4'}>Add Product</Link>
        </div>
          <DataTable/>
      </main>
    </div>
  )
}

export default Inventory
