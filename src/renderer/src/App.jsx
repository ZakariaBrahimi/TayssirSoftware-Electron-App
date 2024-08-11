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
import TopNavbar from "./components/TopNavbar.jsx"

function App() {
  const { getProducts } = useContext(ProductContext)
  const { getSoldProducts } = useContext(SalesContext)
  useEffect(()=>{
    getProducts()
    getSoldProducts()
  }, [])
  return (
    <div className="flex flex-col min-h-lvh bg-yellow-300 " >
      <TopNavbar/>
      <div className="flex  bg-orange-700">
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



      </div>
  )
}

export default App
