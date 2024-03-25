import Inventory from "./components/Inventory.jsx"
import SideNavbar from "./components/SideNavbar.jsx"
function App() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideNavbar/>
      <Inventory/>

      </div>
  )
}

export default App
