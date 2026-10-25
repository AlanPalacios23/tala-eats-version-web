import { useState } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './customer-journey.css';

/**
 * Exact stage hierarchy / wording / dimensional tokens sourced from
 * tala-eats-mobile@f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d
 * ui/welcome_screen.dart and ui/login_methods_screen.dart.
 *
 * Approved images are private binary assets NOT committed to Mobile.
 * Use those exact filenames when supplied, never unapproved stock images.
 */
function LandingPhoto({filename}:{filename:'food_tala.webp'|'food_fiesta.webp'}) {
 const [failed,setFailed]=useState(false);
 return !failed?<img className="te-journey-photo" src={'/landing/'+filename} alt=""
  aria-hidden="true" onError={()=>setFailed(true)} fetchPriority="high"/>:null;
}

export function CustomerWelcome() {
 const navigate=useNavigate(),[failed,setFailed]=useState(false),[continuing,setContinuing]=useState(false);
 return <main className="te-journey te-welcome te-motion-page">
   <LandingPhoto filename="food_tala.webp"/>
   <div className="te-journey-scrim" aria-hidden="true"/>
   <div className="te-welcome-inner">
     <div className="te-welcome-middle">
       {!failed?<img className="te-welcome-wordmark" src="/landing/tala_eats_wordmark_transparent.png"
        alt="Tala Eats" onError={()=>setFailed(true)}/>:
        <span className="te-welcome-wordmark-fallback" aria-label="Tala Eats">Tala Eats</span>}
       <h1>Bienvenido
a Tala Eats</h1>
       <p>Tus platillos favoritos,
más cerca de ti.</p>
     </div>
     <button className="te-welcome-continue" type="button" disabled={continuing}
      onClick={()=>{if(continuing)return;setContinuing(true);navigate('/metodos');}}>
       <span>Continuar</span><ArrowRight size={23}/>
     </button>
   </div>
 </main>;
}

export function CustomerMethods(){
 const navigate=useNavigate();
 return <main className="te-journey te-methods te-motion-page">
   <LandingPhoto filename="food_fiesta.webp"/>
   <div className="te-journey-scrim" aria-hidden="true"/>
   <button type="button" className="te-methods-back" aria-label="Volver a bienvenida" onClick={()=>navigate('/bienvenida')}>
     <ArrowLeft size={25}/>
   </button>
   <div className="te-methods-center">
     <h1>Un antojo,
mil posibilidades.</h1>
     <p>Tus sabores favoritos están más cerca.</p>
   </div>
   <div className="te-methods-bottom">
     <button type="button" className="te-methods-email" onClick={()=>navigate('/acceso')}>
       <Mail size={25}/><span>Continuar con tu correo</span><span aria-hidden="true"/>
     </button>
     <Link className="te-methods-register" to="/acceso" state={{create:true}}>
       ¿Aún no tienes cuenta? Crear cuenta
     </Link>
   </div>
 </main>;
}
