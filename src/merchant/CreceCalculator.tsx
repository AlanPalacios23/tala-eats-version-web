import {useState} from 'react';
import {Calculator,Info,ShieldCheck} from 'lucide-react';
import {creceMoney,crecePricePreview} from './crecePricing';

export default function CreceCalculator(){
 const [raw,setRaw]=useState('250.00');
 const quote=crecePricePreview(raw);
 return <section className="crece-calculator" aria-label="Simulador informativo de comisiones de Tala Eats">
  <div className="crece-calculator-heading">
   <span className="crece-calculator-icon"><Calculator size={23}/></span>
   <div><span className="crece-kicker">COMISIONES TRANSPARENTES</span>
    <h2>Comprueba los números antes de afiliarte</h2>
    <p>Ejemplo de una venta de productos con la política estándar propuesta. No realiza cobros.</p>
   </div>
  </div>
  <div className="crece-calculator-content">
   <div className="crece-calculator-input"><label htmlFor="crece-example-amount">Valor de productos (MXN)</label>
    <div className="crece-calculator-input-field"><span>$</span>
     <input id="crece-example-amount" inputMode="decimal" autoComplete="off"
      value={raw} maxLength={10} placeholder="250.00"
      aria-invalid={!quote} aria-describedby="crece-example-instructions"
      onChange={e=>setRaw(e.target.value)}/><small>MXN</small>
    </div>
    <p id="crece-example-instructions">Escribe un importe positivo, por ejemplo 250.00, con máximo dos decimales.</p>
    <div className="crece-calculator-policy"><ShieldCheck size={17}/>
     <span>17 % de comisión sobre productos, 7 % de servicio al cliente y 0 % sobre propinas. Sin cargo fijo mensual en la propuesta del piloto.</span>
    </div>
   </div>
   <div className="crece-calculator-results" aria-live="polite">
    {quote?<><div><span>Productos</span><strong>{creceMoney(quote.itemSubtotalMinor)}</strong></div>
     <div><span>Comisión al comercio (17 %)</span><strong>−{creceMoney(quote.merchantCommissionMinor)}</strong></div>
     <div className="crece-calculator-total"><span>Importe del comercio antes de ajustes</span>
      <strong>{creceMoney(quote.merchantBeforeAdjustmentsMinor)}</strong></div>
     <div><span>Servicio al cliente (7 %, adicional)</span><strong>{creceMoney(quote.customerServiceMinor)}</strong></div>
     <div><span>Importe referencial al cliente sin envío</span><strong>{creceMoney(quote.customerBeforeDeliveryMinor)}</strong></div>
    </>:<p className="crece-calculator-error" role="status">Introduce un importe válido para calcular el ejemplo. Ningún cargo se ha generado.</p>}
   </div>
  </div>
  <p className="crece-calculator-legal"><Info size={15}/> Ilustración, no cotización ni saldo bancario. No incluye envío, descuentos, impuestos aplicables, ajustes, reembolsos ni costos operativos. El backend y los términos vigentes determinan los importes definitivos de cada pedido.</p>
 </section>;
}
