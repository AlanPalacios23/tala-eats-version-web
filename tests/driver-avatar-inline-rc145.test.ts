import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/components/DriverPwaWorkflow.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/driver-avatar-rc144.css',import.meta.url),'utf8');
const profile=source.split("{tab==='perfil'&&<>")[1]?.split("{(error||message)&&")[0]??'';

describe('RC145: foto del repartidor integrada en el avatar',()=>{
 it('elimina el bloque independiente de subir foto sin alterar el resto del perfil',()=>{
  expect(profile).toContain('df-profile-identity');
  expect(profile).toContain('df-avatar-frame');
  expect(profile).toContain('df-settings');
  expect(profile).toContain('Vehículo');
  expect(profile).toContain('Documentos');
  expect(profile).toContain('Seguridad');
  expect(profile).not.toContain('df-avatar-manager');
  expect(profile).not.toContain('df-avatar-change');
  expect(profile).not.toContain('Tu fotografía');
 });
 it('la cámara accesible junto al círculo abre el selector existente',()=>{
  expect(profile).toContain('className="df-avatar-edit"');
  expect(profile).toContain('aria-label={avatarUrl?\'Cambiar foto de perfil\':\'Subir foto de perfil\'}');
  expect(profile).toContain('<Camera size={16}');
  expect(profile).toContain('onClick={()=>avatarInput.current?.click()}');
  expect(profile).toContain('ref={avatarInput} type="file"');
  expect(profile).toContain('if(file)void changeAvatar(file)');
  expect(profile).toContain('disabled={avatarSaving||operationsBlocked}');
 });
 it('conserva almacenamiento real, foto compartida y estados de guardado o error',()=>{
  expect(source).toContain('const safeBlob=await prepareDriverAvatar(file)');
  expect(source).toContain('const updated=await api.driverUploadAvatar(safeBlob)');
  expect(source).toContain('setUploadedAvatar({userId:actorId!,url:updated.avatar_url})');
  expect(profile).toContain('avatarUrl?<img src={avatarUrl}');
  expect(profile).toContain('role="status">Guardando foto');
  expect(profile).toContain('role="alert">{avatarError}');
 });
 it('el botón es compacto, accesible por teclado y con movimiento reducido',()=>{
  expect(styles).toContain('.df-profile-identity .df-avatar-frame{position:relative');
  expect(styles).toContain('.df-avatar-edit{position:absolute');
  expect(styles).toContain('.df-avatar-edit:focus-visible');
  expect(styles).toContain('.df-avatar-edit::after');
  expect(styles).toContain('@media(prefers-reduced-motion:reduce){.df-avatar-edit{transition:none}}');
  expect(styles).not.toContain('.df-avatar-manager');
 });
});
