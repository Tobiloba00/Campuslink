import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNairaInput(value: string): string {
  // Remove non-numeric characters except decimal point
  const numericValue = value.replace(/[^\d.]/g, '');
  
  // Split by decimal point
  const parts = numericValue.split('.');
  
  // Format the integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Return formatted value (limit to 2 decimal places)
  return parts.length > 1 
    ? `${parts[0]}.${parts[1].slice(0, 2)}`
    : parts[0];
}

export function parseNairaInput(value: string): string {
  // Remove commas for storage
  return value.replace(/,/g, '');
}
