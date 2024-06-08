/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { createContext } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { useToast } from '@shadcn-components/ui/use-toast'

const SalesContext = createContext()
export default SalesContext

export const SalesProvider = ({ children }) => {
//   const navigate = useNavigate()
 
//   const { toast } = useToast()

  const contextData = {
    


  }
  return <SalesContext.Provider value={contextData}>{children}</SalesContext.Provider>
}
