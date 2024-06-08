/* eslint-disable prettier/prettier */
import './assets/main.css'
import ReactDOM from 'react-dom/client'
import App from './App'
import {ProductProvider} from './context/ProductContext';
import { HashRouter } from "react-router-dom";
import { SalesProvider } from './context/SalesContext';


ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <ProductProvider>
    <SalesProvider>
      <App />
    </SalesProvider>
    </ProductProvider>
  </HashRouter>
)
