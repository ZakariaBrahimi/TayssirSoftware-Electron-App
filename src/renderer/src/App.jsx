/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { useContext, useEffect, useState } from 'react'

import { Routes, Route } from 'react-router-dom'

import Login from './screens/auth/Login.jsx'

import LicenseKeyInputPage from './screens/auth/LicenseKeyInputPage.jsx'
import Signup from './screens/auth/Signup.jsx'
const fs = window.api.fs
const path = window.api.path
const os = window.api.os
function App() {
  const [hasLicenseKey, setHasLicenseKey] = useState(false)
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    username: ''
  });

  // Check if license key exists
  useEffect(() => {
    // Path where the license key will be stored (e.g., in the user's home directory)
    const licensePath = path.join(os.homedir(), 'app_license.key')

    // Check if the license key file exists
    fs.access(licensePath, fs.constants.F_OK, (err) => {
      if (err) {
        // License key does not exist
        setHasLicenseKey(false)
      } else {
        // License key exists
        setHasLicenseKey(true)
      }
    })
  }, [])

  return <div>{hasLicenseKey ? authState.isLoggedIn ? <Login authState={authState} setAuthState={setAuthState} /> : <Signup authState={authState} setAuthState={setAuthState} /> : <LicenseKeyInputPage />}</div>
}

export default App
