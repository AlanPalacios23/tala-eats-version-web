import {useEffect} from 'react';
import {Link,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {useSession} from './lib/session';
import {DriverPwaWorkflow} from './components/DriverPwaWorkflow';
import {DriverAccess,DriverRegistration,DriverBrand} from './components/DriverRegistration';
import {PREVIEW_READONLY} from './lib/preview';
import {DriverPwaInstallNotice} from './components/DriverPwaInstall';

/** Dedicated driver origin. It does not import customer checkout or restaurant UIs.
 * Role is verified via SAME-ORIGIN authenticated /api/v1/auth/me and on every API action.
 */
function DriverEntry(){
 const {user,loading}=useSession();
 if(loading)return <div className="dd-boot" role="status"><DriverBrand/><p>Verificando tu acceso de repartidor…</p></div>;
 if(user?.role==='driver')return <DriverPwaWorkflow/>;
 return <DriverAccess/>;
}
export default function DriverStandalone(){
 const location=useLocation();
 useEffect(()=>{document.title='Tala Eats Repartidor · '+
 (location.pathname==='/repartidor/registro'?'Crear cuenta':
 location.pathname==='/repartidor/acceso'?'Acceso':'Mis entregas');},[location.pathname]);
 return <div className="dd-standalone" data-driver-standalone="true">
  {PREVIEW_READONLY&&<aside className="dd-preview" role="status">VISTA PREVIA · Sin operaciones ni pagos reales</aside>}
  <Routes>
   <Route path="/" element={<Navigate to="/repartidor" replace/>}/>
   <Route path="/repartidor" element={<DriverEntry/>}/>
   <Route path="/repartidor/acceso" element={<DriverAccess/>}/>
   <Route path="/repartidor/registro" element={<DriverRegistration/>}/>
   <Route path="*" element={<main className="dd-unknown"><h1>Esta sección no pertenece a Repartidores</h1>
    <p>Accede a tus entregas desde la aplicación de Repartidores.</p><Link to="/repartidor">Ir a Repartidor</Link>
    <a href="https://web-talaeats.alan-palacios-dev.com/">Ir al portal Tala Eats</a></main>}/>
  </Routes>
  <DriverPwaInstallNotice/>
 </div>;
}
