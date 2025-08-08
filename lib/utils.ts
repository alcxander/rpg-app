import { clsx, type ClassValue } from "clsx" // Added these imports
import { twMerge } from "tailwind-merge" // Added these imports

// Utility function to parse coordinates like "A1" into {x, y}
export const parseCoordinate = (coord: string) => {
  if (!coord || coord.length < 2) {
    console.warn(`Invalid coordinate string: ${coord}`);
    return { x: 0, y: 0 }; // Default to 0,0 or handle error as appropriate
  }
  const col = coord.charCodeAt(0) - 'A'.charCodeAt(0);
  const row = parseInt(coord.substring(1)) - 1;
  return { x: col, y: row };
};

// Utility function for conditionally joining Tailwind CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Inverse: format grid coordinates from 0-based x,y into "A1"
export const formatCoordinate = (x: number, y: number) => {
  const col = String.fromCharCode('A'.charCodeAt(0) + Math.max(0, x));
  const row = (Math.max(0, y) + 1).toString();
  return `${col}${row}`;
};