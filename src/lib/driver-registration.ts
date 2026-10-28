export type DriverVehicle='Motocicleta'|'Automóvil'|'Bicicleta';
export function normalizeDriverPlate(raw:string):string {
 return raw.toUpperCase().replace(/[^A-Z0-9 -]/g,'').slice(0,30);
}
export function driverPlateIsValid(vehicle:DriverVehicle,plate:string):boolean {
 return vehicle==='Bicicleta'?plate==='':/^(?=.{4,12}$)[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/.test(plate);
}
export function maskedDriverPlate(plate:unknown):string {
 if(typeof plate!=='string'||!plate.trim())return 'Sin placas registradas';
 const cleaned=normalizeDriverPlate(plate);
 return cleaned.length>2?'•••• '+cleaned.slice(-2):'••';
}
