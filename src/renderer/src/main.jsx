/* eslint-disable prettier/prettier */
import './assets/main.css'
import ReactDOM from 'react-dom/client'
import App from './App'
import {ProductProvider} from './context/ProductContext';
ReactDOM.createRoot(document.getElementById('root')).render(
    <ProductProvider>
      <App />
    </ProductProvider>
)
