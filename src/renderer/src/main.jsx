/* eslint-disable prettier/prettier */
import './assets/main.css'
import ReactDOM from 'react-dom/client'
import App from './App'
import {ProductProvider} from './context/ProductContext';
import { HashRouter } from "react-router-dom";


ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <ProductProvider>
      <App />
    </ProductProvider>
  </HashRouter>
)
