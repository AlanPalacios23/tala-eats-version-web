import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {SessionProvider} from './lib/session';
import {PREVIEW_READONLY} from './lib/preview';
import RestaurantStandalone from './RestaurantStandalone';
import './styles/restaurant-standalone.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
  <BrowserRouter><SessionProvider><RestaurantStandalone/></SessionProvider></BrowserRouter>
 </React.StrictMode>
);
requestAnimationFrame(()=>requestAnimationFrame(()=>{
 document.getElementById('merchant-first-paint')?.remove();
}));
if('serviceWorker' in navigator&&import.meta.env.PROD&&!PREVIEW_READONLY){
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('/sw-restaurante.js',{scope:'/'}).catch(()=>{});
 });
}
