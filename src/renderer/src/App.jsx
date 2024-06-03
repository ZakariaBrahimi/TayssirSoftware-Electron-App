/* eslint-disable prettier/prettier */
import { useContext, useEffect } from "react"
import Inventory from "./components/Inventory.jsx"
import SideNavbar from "./components/SideNavbar.jsx"
import { Toaster } from "@shadcn-components/ui/toaster"
import ProductContext from "./context/ProductContext"
import  Dashboard  from "./components/Dashboard"
import Add from "./components/AddProduct.jsx"
import {
  Routes ,
  Route,
  Outlet,
} from "react-router-dom";
function App() {
  const { getProducts } = useContext(ProductContext)
  useEffect(()=>{
    getProducts()

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
        {/* <Route path="home" element={ <Dashboard/> }/> */}
        <Route path="inventory/add-new-product" element={ <Add/> }/>
        <Route path="inventory" element={ <Inventory/> }/>
        
        {/* <Route path="/user/:userId" element={<User />} /> */}
      </Routes>
      </div>
  )
}

export default App
