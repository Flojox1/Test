// =====================================================================
//  FloRod — Arsa (il) mantığı
//  Her il bir arsadır. Bir arsada açılabilecek konteyner sayısı = ilçe sayısı.
//  Fiyat: nüfus ve ilçe sayısına göre hesaplanır (aşağıdaki sabitleri değiştirerek ayarla).
// =====================================================================
import { PROVINCES } from './provinces.js';

export const START_PLOT = 0;            // Şehirden bağımsız ücretsiz mantar üretim alanı

const BASE_PRICE   = 15000;             // her arsanın taban fiyatı
const PER_1000_POP = 20;                // her 1.000 kişi için ek fiyat
const PER_DISTRICT = 2000;              // her ilçe (= konteyner hakkı) için ek fiyat

const BY_PLATE = new Map(PROVINCES.map(p => [p.plate, p]));

export function getProvince(plate) {
  return BY_PLATE.get(Number(plate)) || null;
}

// En yakın 1.000 ₺'ye yuvarlanmış arsa fiyatı
export function plotPrice(prov) {
  const raw = BASE_PRICE + prov.pop * PER_1000_POP + prov.districts * PER_DISTRICT;
  return Math.round(raw / 1000) * 1000;
}

// Arsada açılabilecek en fazla konteyner sayısı (= ilçe sayısı)
export function plotCapacity(plate) {
  const p = getProvince(plate);
  return p ? p.districts : 0;
}
