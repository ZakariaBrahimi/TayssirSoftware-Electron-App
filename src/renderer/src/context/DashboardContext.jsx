/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { createContext, useState } from 'react'
// import { useNavigate } from 'react-router-dom'

const DashboardContext = createContext()
export default DashboardContext

export const DashboardProvider = ({ children }) => {
    

  const contextData = {
    
  }
  return <DashboardContext.Provider value={contextData}>{children}</DashboardContext.Provider>
}
