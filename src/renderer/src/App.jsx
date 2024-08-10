/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { useContext, useEffect } from "react"
import Inventory from "./screens/inventory/Inventory.jsx"
import SideNavbar from "./components/SideNavbar.jsx"
import { Toaster } from "@shadcn-components/ui/toaster"
import ProductContext from "./context/ProductContext"
import  Dashboard  from "./screens/dashboard/Dashboard.jsx"
import AddProduct from "./screens/inventory/AddProduct.jsx"
import {
  Routes ,
  Route,
  Outlet,
} from "react-router-dom";
import Sales from "./screens/sales/Sales.jsx"
import EditProduct from "./screens/inventory/EditProduct.jsx"
import SalesContext from "./context/SalesContext.jsx"
import Reports from './screens/reports/Reports.jsx'
import Login from "./screens/auth/Login.jsx"

function App() {
  const { getProducts } = useContext(ProductContext)
  const { getSoldProducts } = useContext(SalesContext)
  useEffect(()=>{
    getProducts()
    getSoldProducts()
  }, [])
  return (
    // <div className="grid grid-flow-col min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
    <div className="flex min-h-screen " >
      <SideNavbar/>
      <Outlet/>
      <Toaster />



      <Routes>
        <Route path="/" element={ <Dashboard/> }/>
        <Route path="inventory/add-new-product" element={ <AddProduct/> }/>
        <Route path="inventory/edit-product" element={ <EditProduct/> }/>
        <Route path="inventory" element={ <Inventory/> }/>
        <Route path="sales" element={ <Sales/> }/>
        <Route path="analytics" element={ <Reports/> }/>
        <Route path="analytics" element={ <Reports/> }/>
        <Route path="login" element={ <Login/> }/>
        
        {/* <Route path="/user/:userId" element={<User />} /> */}
      </Routes>
      </div>
  )
}

export default App
