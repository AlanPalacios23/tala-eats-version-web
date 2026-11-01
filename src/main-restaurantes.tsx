import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {SessionProvider} from './lib/session';
import MerchantStandalone from './merchant/MerchantStandalone';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter><SessionProvider><MerchantStandalone/></SessionProvider></BrowserRouter>
  </React.StrictMode>
);
// On restaurant hostname, only the independent SW is allowed by the existing
// isolated nginx 18197 config. It does not control Customers or Drivers.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw-restaurante.js',{scope:'/'}).catch(()=>{});
  });
}
