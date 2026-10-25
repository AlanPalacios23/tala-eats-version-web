import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { api } from './api';
import type { User } from './types';

interface Session { user:User|null; loading:boolean; login:(email:string,password:string,otp?:string)=>Promise<User>; register:(name:string,email:string,password:string)=>Promise<void>; logout:()=>Promise<void>; refresh:()=>Promise<void>; }
const SessionContext=createContext<Session|null>(null);
export function SessionProvider({children}:PropsWithChildren) {
 const [user,setUser]=useState<User|null>(null);
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{try{setUser(await api.me());}catch{setUser(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const login=async(email:string,password:string,otp?:string):Promise<User>=>{const response=await api.login(email,password,otp);setUser(response.user);return response.user;};
 const register=async(name:string,email:string,password:string)=>{const response=await api.register(name,email,password);setUser(response.user);};
 const logout=async()=>{try{await api.logout();}finally{setUser(null);}};
 return <SessionContext.Provider value={{user,loading,login,register,logout,refresh}}>{children}</SessionContext.Provider>;
}
export function useSession():Session {const s=useContext(SessionContext);if(!s)throw new Error('SessionProvider requerido');return s;}
