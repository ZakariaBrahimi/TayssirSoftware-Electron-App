/* eslint-disable prettier/prettier */

// import { useContext } from "react"
import { columns } from "./table/columns"
// import { payments } from "./table/data-table"
import { DataTable } from "./table/DataTable"

const Productlist = () => {
    // const { products } = useContext(ProductContext)
  return (
    <DataTable columns={columns}  />
  )
}

export default Productlist