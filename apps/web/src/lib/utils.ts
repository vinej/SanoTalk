import { clsx, type ClassValue } from "clsx"
//import { twMerge } from "tailwind-merge"

const { twMerge } = require("tailwind-merge");
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
