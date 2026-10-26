import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { api, ApiError } from './api';
import type { User } from './types';
import {clearForeignWebPush,revokeWebPushBeforeLogout} from './web-push';

interface Session {user:User|null;loading:boolean;login:(email:string,password:string,otp?:string)=>Promise<void>;register:(name:string,email:string,password:string)=>Promise<void>;logout:()=>Promise<void>;refresh:()=>Promise<void>;}
const SessionContext=createContext<Session|null>(null);
const minimumLaunchMs=1000;
const settle=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

export function SessionProvider({children}:PropsWithChildren){
 const [user,setUser]=useState<User|null>(null);
 const [loading,setLoading]=useState(true);
 // Abort stale /auth/me fetches logically. Old bootstrap responses MUST NOT
 // overwrite a successful login or logout (critical real-world 401 race).
 const epoch=useRef(0);
 const booted=useRef(false);
 const refresh=useCallback(async()=>{
  const current=++epoch.current;
  try{
   const response=await api.me();
   if(current===epoch.current)setUser(response);
  }catch(e){
   // A network error or 5xx is not proof that the account logged out.
   if(current===epoch.current&&(e instanceof ApiError&&(e.status===401||e.status===403)))setUser(null);
  }finally{
   if(current===epoch.current){setLoading(false);booted.current=true;}
  }
 },[]);
 useEffect(()=>{
  let active=true;
  const current=++epoch.current;
  const run=async()=>{
   // Flutter LaunchScreen lasts for its initial initialization + brand moment.
   const [me]=await Promise.allSettled([api.me(),settle(minimumLaunchMs)]);
   if(!active||current!==epoch.current)return;
   if(me.status==='fulfilled')setUser(me.value);
   else setUser(null); // Initial startup is never considered authenticated on uncertainty.
   setLoading(false);booted.current=true;
  };
  void run();
  return()=>{active=false;epoch.current++;};
 },[]);
 const login=async(email:string,password:string,otp?:string)=>{
  const current=++epoch.current;
  await api.login(email,password,otp);
  // The server session cookie must work through the SAME public domain.
  // Don't navigate from the login form using an unverified auth response.
  const verified=await api.me();
  if(current===epoch.current){setUser(verified);setLoading(false);booted.current=true;}
 };
 const register=async(name:string,email:string,password:string)=>{
  const current=++epoch.current;
  await api.register(name,email,password);
  const verified=await api.me();
  if(current===epoch.current){setUser(verified);setLoading(false);booted.current=true;}
 };
 useEffect(()=>{
  if(user?.id)void clearForeignWebPush(user.id);
 },[user?.id]);
 const logout=async()=>{
  const current=++epoch.current;
  if(user?.id)await revokeWebPushBeforeLogout(user.id);
  try{await api.logout();if(current===epoch.current)setUser(null);}
  finally{if(current===epoch.current){setLoading(false);booted.current=true;}}
 };
 return <SessionContext.Provider value={{user,loading,login,register,logout,refresh}}>{children}</SessionContext.Provider>;
}
export function useSession():Session{
 const value=useContext(SessionContext);
 if(!value)throw new Error('SessionProvider requerido');
 return value;
}
