/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { useContext, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LicenseKeyInputPage from './screens/auth/LicenseKeyInputPage.jsx'
import Inventory from './screens/inventory/Inventory.jsx'
import SideNavbar from './components/SideNavbar.jsx'
import { Toaster } from '@shadcn-components/ui/toaster'
import ProductContext from './context/ProductContext'
import Dashboard from './screens/dashboard/Dashboard.jsx'
import AddProduct from './screens/inventory/AddProduct.jsx'
import Sales from './screens/sales/Sales.jsx'
import EditProduct from './screens/inventory/EditProduct.jsx'
import SalesContext from './context/SalesContext.jsx'
import Reports from './screens/reports/Reports.jsx'
import Login from './screens/auth/Login.jsx'
import TopNavbar from './components/TopNavbar.jsx'
import Signup from './screens/auth/Signup.jsx'
import MainAppContent from './MainAppContent.jsx'
import Settings from './screens/settings/Settings.jsx'

const fs = window.api.fs
const path = window.api.path
const os = window.api.os

function App() {
  const [authState, setAuthState] = useState({
    hasLicenseKey: false,
    isLoggedIn: false,
    user: ''
  })
  

  // Storing user session in local storage
  useEffect(() => {
    localStorage.setItem('userSession', JSON.stringify(authState))
  }, [authState])

  // Check if license key exists
  useEffect(() => {
    const licensePath = path.join(os.homedir(), 'app_license.key')

    fs.access(licensePath, fs.constants.F_OK, (err) => {
      if (err) {
        // License key does not exist
        setAuthState((prevState) => ({ ...prevState, hasLicenseKey: false }))
      } else {
        // License key exists
        setAuthState((prevState) => ({ ...prevState, hasLicenseKey: true }))
      }
    })
  }, [])

  return (
    <>
      {/* <h1>hhhhhh</h1> */}
      <Toaster />
      <Routes>
        {/* PUBLIC ROUTES */}
        {!authState?.hasLicenseKey ? (
          <>
            <Route path="/license" element={<LicenseKeyInputPage setAuthState={setAuthState} />} />
            <Route path="*" element={<Navigate to="/license" />} />
          </>
        ) : !authState?.isLoggedIn ? (
          <>
            <Route path="/login" element={<Login setAuthState={setAuthState} />} />
            <Route path="/signup" element={<Signup setAuthState={setAuthState} />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          <>
            {/* PROTECTED ROUTES */}
            <Route path="/" element={<MainAppContent setAuthState={setAuthState} />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="inventory/add-new-product" element={<AddProduct />} />
              <Route path="inventory/edit-product" element={<EditProduct />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="sales" element={<Sales />} />
              <Route path="analytics" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </>
        )}
      </Routes>
    </>
  )
}

export default App

{
  /* 
- if license key exists:
- validate the key 
- then render login page
- render main content
- if license key doesn't exists: 
- render license key input page 
- then render signup page 
- render login page

*/
}
