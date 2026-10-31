/** Deterministic, pure guards shared by the driver UI. */
export function freshAuthorisedOfferIds(
 current:readonly number[],previous:ReadonlySet<number>|null,
 allowed:boolean,
):number[]{
 if(!allowed||!previous)return [];
 return current.filter(id=>Number.isSafeInteger(id)&&id>0&&!previous.has(id));
}

export type DriverWorkDay={deliveries:number;earnings:number;date:string};
export type DriverPerformanceSummary={deliveries:number;activeDays:number;days:number};
/** Read-only metrics from the authenticated dashboard; never a payout ledger. */
export function safeDriverPerformanceSummary(value:unknown):DriverPerformanceSummary|null{
 if(!Array.isArray(value)||value.length===0||value.length>7)return null;
 const days=value as unknown[];
 if(!days.every(d=>d!==null&&typeof d==='object'&&
    Number.isSafeInteger((d as DriverWorkDay).deliveries)&&
    (d as DriverWorkDay).deliveries>=0&&
    typeof (d as DriverWorkDay).date==='string'&&
    /^\d{4}-\d{2}-\d{2}$/.test((d as DriverWorkDay).date)
 ))return null;
 const rows=days as DriverWorkDay[];
 return {
  deliveries:rows.reduce((sum,row)=>sum+row.deliveries,0),
  activeDays:rows.filter(row=>row.deliveries>0).length,
  days:rows.length,
 };
}
