import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 MAX_ONBOARDING_BYTES, onboardingFileFormat, onboardingSelectionError,
 prepareOnboardingDocument, prepareOnboardingDocuments,
} from '../src/lib/onboarding-documents';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');

describe('RC136 driver verification documents on mobile',()=>{
 it('checks real file magic instead of trusting Android picker MIME',()=>{
   expect(onboardingFileFormat(new Uint8Array([255,216,255,224]))).toBe('image/jpeg');
   expect(onboardingFileFormat(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe('image/png');
   expect(onboardingFileFormat(new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]))).toBe('image/webp');
   expect(onboardingFileFormat(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
   expect(onboardingFileFormat(new TextEncoder().encode('not a document'))).toBeNull();
 });
 it('repairs MIME for a genuine Android JPEG with empty/octet-stream type',async()=>{
   const file=new File([new Uint8Array([255,216,255,0,1,2])],'tarjeta-circulacion.jpg',{type:'application/octet-stream'});
   const prepared=await prepareOnboardingDocument(file);
   expect(prepared.type).toBe('image/jpeg');
   expect(prepared.name).toBe(file.name);
   expect(prepared.size).toBe(file.size);
 });
 it('does not accept a renamed fake JPEG or an empty file',async()=>{
   const fake=new File(['plain text'],'tarjeta.jpg',{type:'image/jpeg'});
   await expect(prepareOnboardingDocument(fake)).rejects.toThrow(/no es JPG/);
   const empty=new File([],'empty.pdf',{type:'application/pdf'});
   await expect(prepareOnboardingDocument(empty)).rejects.toThrow(/vacío/);
 });
 it('rejects oversized PDF and more than 3 files before account registration',async()=>{
   const pdf=new File([new Uint8Array(MAX_ONBOARDING_BYTES+1).fill(32)],'tarjeta.pdf',{type:'application/pdf'});
   await expect(prepareOnboardingDocument(pdf)).rejects.toThrow(/límite es 5 MB/);
   const sample=new File([new Uint8Array([255,216,255])],'documento.jpg',{type:'image/jpeg'});
   expect(onboardingSelectionError([sample,sample,sample,sample])).toMatch(/máximo de 3/);
   await expect(prepareOnboardingDocuments([sample,sample,sample,sample])).rejects.toThrow(/máximo de 3/);
 });
 it('prepares evidence before creating the account and uploads with FormData',()=>{
   const driver=read('../src/components/DriverRegistration.tsx');
   const api=read('../src/lib/api.ts');
   expect(driver.indexOf('await prepareOnboardingDocuments(documents)')).toBeLessThan(driver.indexOf('await session.register('));
   expect(driver).toContain('setUploadProgress(');
   expect(driver).not.toContain('<DriverBrand/>');
   expect(api).toContain("form.append('file',file,file.name)");
   expect(api).toContain("'/uploads/onboarding-document'");
   expect(api).not.toContain("headers:{'Content-Type':'multipart/form-data'");
 });
});

describe('RC136 installed mobile experience',()=>{
 it('all four PWA manifests request immersive Android with standalone fallback',()=>{
   for(const path of ['manifest.webmanifest','manifest-clientes.webmanifest',
                        'manifest-restaurante.webmanifest','manifest-repartidor.webmanifest']){
     const manifest=JSON.parse(read('../public/'+path));
     expect(manifest.display).toBe('standalone');
     expect(manifest.display_override).toEqual(['fullscreen','standalone']);
     expect(manifest.start_url.startsWith('/')).toBe(true);
   }
 });
 it('each separate portal has a mobile viewport and iOS standalone capability',()=>{
   for(const path of ['../index.html','../restaurantes.html','../repartidores.html']){
     const html=read(path);
     expect(html).toContain('viewport-fit=cover');
     expect(html).toContain('apple-mobile-web-app-capable');
     expect(html).toContain('mobile-web-app-capable');
   }
   expect(read('../repartidores.html')).not.toContain('<div><img src="/branding/tala-eats-driver-official.png"');
 });
});
