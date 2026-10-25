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
     path === '/buscar' || path === '/acceso' || path === '/tala-club' || path === '/notificaciones' || path === '/soporte' || path === '/favoritos' || path === '/carrito' || path === '/checkout' || path === '/direcciones' || path === '/pedidos' || path.startsWith('/pedidos/') ||
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
