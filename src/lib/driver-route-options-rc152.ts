import type {Order} from './types';
import {safeDriverMapLink,trustedActiveDriverDetail} from './driver-delivery-ui';
import type {DriverDashboardPayload} from './driver-delivery-ui';
import {driverJourneyNavigationHref,driverJourneyStage} from './driver-journey-ux';

export type DriverNavigationChoices={
 destination:'Comercio'|'Cliente';
 google:string;
 apple:string;
};
/** Both links start a map app ONLY after a user taps; no GPS, route history,
 * ETA or customer data is transmitted by our backend. The active order alone
 * determines the next destination, never a stale/other driver's dashboard.
 */
export function driverNavigationChoices(
 order:Order|null,dashboard:DriverDashboardPayload|null,
):DriverNavigationChoices|null{
 const stage=driverJourneyStage(order?.status);
 if(!order||!stage)return null;
 const details=trustedActiveDriverDetail(dashboard,order);
 const embedded=(order as Order&{restaurant?:{address?:unknown}}).restaurant;
 const target:unknown=stage.step===1
  ?details?.restaurant?.address||embedded?.address
  :order.address||details?.customer?.address;
 if(!safeDriverMapLink(target))return null;
 const google=driverJourneyNavigationHref(order,dashboard);
 if(!google)return null;
 return {
  destination:stage.step===1?'Comercio':'Cliente',
  google,
  apple:'https://maps.apple.com/?daddr='+encodeURIComponent((target as string).trim())+'&dirflg=d',
 };
}
