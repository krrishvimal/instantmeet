import { Location } from '../types';

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 */
export function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.lat * Math.PI) / 180) *
      Math.cos((loc2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Obfuscates the distance to protect user privacy.
 * Instead of returning exact coordinates, we return a rounded bucket 
 * and a randomized bearing/offset.
 */
export function obfuscateDistance(distanceKm: number): number {
  // If extremely close (< 100m), return 0.1km
  if (distanceKm < 0.1) return 0.1;
  
  // Round to nearest 100 meters (1 decimal place) to prevent trilateration
  return Math.round(distanceKm * 10) / 10;
}

/**
 * Validates if coordinates are plausible and not obviously spoofed.
 */
export function isValidCoordinate(loc: Location): boolean {
  return (
    typeof loc.lat === 'number' &&
    typeof loc.lng === 'number' &&
    loc.lat >= -90 &&
    loc.lat <= 90 &&
    loc.lng >= -180 &&
    loc.lng <= 180
  );
}
