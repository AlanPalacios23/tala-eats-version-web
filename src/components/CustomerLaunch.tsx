/** Real initial-session-restore loader. Use the same exact first screen
 * rather than flashing a different white/Georgia splash before onboarding.
 * CustomerEntry renders the actual tappable orange arrow once auth is known.
 */
export function CustomerLaunch(){
 return <div className="customer-launch-screen customer-launch-exact" role="status" aria-label="Tala Eats: preparando tu experiencia" data-mobile-screen="launch">
   <img className="customer-launch-exact-art" src="/branding/splash-exacto-728x1536.webp" width="728" height="1536" alt="Tala Eats. Pide, disfruta y repite." onError={e=>{e.currentTarget.style.display='none';}} draggable={false}/>
   <span className="customer-launch-accessible">Preparando tu experiencia…</span>
 </div>;
}
