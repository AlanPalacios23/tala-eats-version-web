import React from 'react';
import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { SessionProvider } from './lib/session';
import App from './App';
import './styles/main.css';

// Four app identities share one vetted frontend and one LIVE backend.
// Changing the manifest changes only the installable shell, never auth roles
// or the server's authority to accept payments and driver dispatch.
export function manifestForPath(path: string): string {
 if (path === '/restaurante' || path.startsWith('/restaurante/')) return '/manifest-restaurante.webmanifest';
 if (path === '/repartidor' || path.startsWith('/repartidor/')) return '/manifest-repartidor.webmanifest';
 if (path === '/clientes' || path.startsWith('/clientes/') ||
     path === '/carrito' || path === '/pedidos' ||
     path === '/cuenta' || path.startsWith('/comercio/')) return '/manifest-clientes.webmanifest';
 return '/manifest.webmanifest';
}
function PortalInstallIdentity() {
 const location = useLocation();
 useEffect(() => {
   const href = manifestForPath(location.pathname);
   const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
   if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
   const label = href.includes('restaurante') ? 'Restaurantes' :
      href.includes('repartidor') ? 'Repartidores' :
      href.includes('clientes') ? 'Clientes' : 'Inicio';
   document.title = 'Tala Eats · ' + label;
   // Icono/título y barra de sistema coherentes al entrar al portal Restaurante.
   // Safari puede usar apple-mobile-web-app-title al añadirla a inicio.
   const merchant=href.includes('restaurante');
   const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
   if (theme) theme.setAttribute('content',merchant?'#ffffff':'#080808');
   const appleTitle=document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
   if(appleTitle)appleTitle.setAttribute('content',merchant?'Tala Negocios':'Tala Eats');
   const appleIcon=document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
   if(appleIcon)appleIcon.setAttribute('href',merchant?'/icons/restaurante-180.png':'/icons/icon-192.png');
 }, [location.pathname]);
 return null;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode><BrowserRouter><PortalInstallIdentity/><SessionProvider><App/></SessionProvider></BrowserRouter></React.StrictMode>
);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
 window.addEventListener('load', () => {
   navigator.serviceWorker.register('/sw.js', {scope:'/'}).catch(() => {});
 });
}
