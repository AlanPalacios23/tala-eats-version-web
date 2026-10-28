import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {SessionProvider} from './lib/session';
import {PREVIEW_READONLY} from './lib/preview';
import DriverStandalone from './DriverStandalone';
import './styles/driver-standalone.css';
import './styles/driver-flutter.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode><BrowserRouter><SessionProvider><DriverStandalone/></SessionProvider></BrowserRouter></React.StrictMode>
);
requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('driver-first-paint')?.remove()));
if('serviceWorker' in navigator&&import.meta.env.PROD&&!PREVIEW_READONLY){
 window.addEventListener('load',()=>void navigator.serviceWorker.register('/sw-repartidor.js',{scope:'/'}).catch(()=>{}));
}
