import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from './lib/session';
import App from './App';
import './styles/main.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode><BrowserRouter><SessionProvider><App/></SessionProvider></BrowserRouter></React.StrictMode>
);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
 window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});});
}
