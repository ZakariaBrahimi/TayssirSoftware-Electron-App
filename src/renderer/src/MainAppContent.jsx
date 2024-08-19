/* eslint-disable prettier/prettier */
import { useContext, useEffect } from "react"
// import Inventory from "./screens/inventory/Inventory.jsx"
import SideNavbar from "./components/SideNavbar.jsx"
import { Toaster } from "@shadcn-components/ui/toaster"
import ProductContext from "./context/ProductContext"
// import  Dashboard  from "./screens/dashboard/Dashboard.jsx"
// import AddProduct from "./screens/inventory/AddProduct.jsx"
import {
  // Routes ,
  // Route,
  Outlet,
} from "react-router-dom";
// import Sales from "./screens/sales/Sales.jsx"
// import EditProduct from "./screens/inventory/EditProduct.jsx"
import SalesContext from "./context/SalesContext.jsx"
// import Reports from './screens/reports/Reports.jsx'
// import Login from "./screens/auth/Login.jsx"
import TopNavbar from "./components/TopNavbar.jsx"
// import Signup from "./screens/auth/Signup.jsx"


const MainAppContent = () => {
    // Fetch products and sold products
  const { getProducts } = useContext(ProductContext)
  const { getSoldProducts } = useContext(SalesContext)
  useEffect(()=>{
    getProducts()
    getSoldProducts()
  }, [])
  return (
    <div className="flex flex-col min-h-lvh " >
      <TopNavbar/>
      <div className="flex  ">
        <SideNavbar/>
        <Outlet/>

      <Toaster />
      
      </div>



      </div>
  )
}

export default MainAppContent