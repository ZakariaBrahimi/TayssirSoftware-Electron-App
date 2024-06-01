/* eslint-disable prettier/prettier */
import { useContext, useEffect } from "react"
import Inventory from "./components/Inventory.jsx"
import SideNavbar from "./components/SideNavbar.jsx"
import { Toaster } from "@shadcn-components/ui/toaster"
import ProductContext from "./context/ProductContext"

function App() {
  const { getProducts } = useContext(ProductContext)
  useEffect(()=>{
    getProducts()

  }, [])
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideNavbar/>
      <Inventory/>
      <Toaster />
      </div>
  )
}

export default App
