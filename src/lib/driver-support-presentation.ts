export function driverTicketStatusLabel(value:unknown):string{
 switch(value){
  case 'open':return 'Abierto';
  case 'in_progress':return 'En revisión';
  case 'resolved':return 'Atendido';
  case 'closed':return 'Cerrado';
  default:return 'Registrado';
 }
}
export function verifiedTicketReply(value:unknown):string|null{
 if(typeof value!=='string')return null;
 const clean=value.trim();
 return clean.length>0&&clean.length<=1200?clean:null;
}
