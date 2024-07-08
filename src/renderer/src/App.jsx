/* eslint-disable prettier/prettier */
import { useContext, useEffect } from "react"
import Inventory from "./components/Inventory.jsx"
import SideNavbar from "./components/SideNavbar.jsx"
import { Toaster } from "@shadcn-components/ui/toaster"
import ProductContext from "./context/ProductContext"
import  Dashboard  from "./components/Dashboard"
import AddProduct from "./components/AddProduct"
import {
  Routes ,
  Route,
  Outlet,
} from "react-router-dom";
import Sales from "./screens/sales/Sales.jsx"
import EditProduct from "./components/EditProduct.jsx"
import SalesContext from "./context/SalesContext.jsx"
import Analytics from "./components/Analytics.jsx"
function App() {
  const { getProducts } = useContext(ProductContext)
  const { getSoldProducts } = useContext(SalesContext)
  useEffect(()=>{
    getProducts()
    getSoldProducts()
  }, [])
  return (
    // <div className="grid grid-flow-col min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
    <div className="flex min-h-screen ">
      <SideNavbar/>
      <Outlet/>
      {/* <Inventory/>  */}
      {/* <Add/> */}
      {/* <Dashboard/> */}
      <Toaster />



      <Routes>
        <Route path="/" element={ <Dashboard/> }/>
        <Route path="inventory/add-new-product" element={ <AddProduct/> }/>
        <Route path="inventory/edit-product" element={ <EditProduct/> }/>
        <Route path="inventory" element={ <Inventory/> }/>
        <Route path="sales" element={ <Sales/> }/>
        <Route path="analytics" element={ <Analytics/> }/>
        
        {/* <Route path="/user/:userId" element={<User />} /> */}
      </Routes>
      </div>
  )
}

export default App
