import {useEffect} from 'react';
import {Link,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {ShieldAlert} from 'lucide-react';
import {useSession} from './lib/session';
import {RestaurantWelcome} from './components/RestaurantWelcome';
import {
 RestaurantAccess,RestaurantOnboarding,RestaurantWorkspace,RestaurantAdminActivation
} from './components/RestaurantApp';
import {AdminPickupConnect} from './components/AdminPickupConnect';
import {PREVIEW_READONLY} from './lib/preview';
import {mainTalaEatsPortalHref} from './lib/restaurant-host';

function MerchantEntry(){
 const {user,loading}=useSession();
 if(loading)return <div className="rm-standalone-loading" role="status">Preparando Tala Eats Restaurantes…</div>;
 if(user?.role==='restaurant')return <RestaurantWorkspace/>;
 if(user?.role==='admin')return <Navigate to="/admin/solicitudes-restaurantes" replace/>;
 return <RestaurantWelcome existingCustomer={user?.role==='customer'}/>;
}
function AdminOnly({children}:{children:React.ReactNode}){
 const {user,loading}=useSession();
 if(loading)return <div className="rm-standalone-loading" role="status">Verificando permisos…</div>;
 if(!user)return <Navigate to="/restaurante/acceso" replace/>;
 if(user.role!=='admin')return <div className="rm-standalone-denied"><ShieldAlert size={30}/><h1>Acceso reservado</h1><p>Tu cuenta no tiene permisos de administración. Los permisos se verifican en el servidor.</p><Link to="/restaurante">Volver a Restaurantes</Link></div>;
 return <>{children}</>;
}
export default function RestaurantStandalone(){
 const location=useLocation();
 useEffect(()=>{document.title='Tala Eats Restaurantes · '+(
  location.pathname==='/restaurante/acceso'?'Acceso':
  location.pathname==='/restaurante/alta'?'Activación':
  location.pathname.startsWith('/admin/')?'Administración':'Mi negocio');},[location.pathname]);
 return <div className="merchant-standalone-app" data-merchant-standalone="true">
  {PREVIEW_READONLY&&<div className="rm-readonly-banner" role="status">VISTA PREVIA · Cambios y operaciones financieras bloqueados</div>}
  <Routes>
   <Route path="/" element={<Navigate to="/restaurante" replace/>}/>
   <Route path="/restaurante" element={<MerchantEntry/>}/>
   <Route path="/restaurante/acceso" element={<RestaurantAccess/>}/>
   <Route path="/restaurante/alta" element={<RestaurantOnboarding/>}/>
   <Route path="/admin/solicitudes-restaurantes" element={<AdminOnly><RestaurantAdminActivation/></AdminOnly>}/>
   <Route path="/admin/conectar-restaurante" element={<AdminOnly><AdminPickupConnect/></AdminOnly>}/>
   <Route path="*" element={<div className="rm-standalone-denied"><h1>Esta página no pertenece a Restaurantes</h1><p>Para pedir comida, utiliza la aplicación para clientes.</p>
    <Link to="/restaurante">Ir a Restaurantes</Link>
    <a href={mainTalaEatsPortalHref(window.location.hostname)}>Abrir Tala Eats</a>
   </div>}/>
  </Routes>
 </div>;
}
