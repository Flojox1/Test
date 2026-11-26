// =====================================================================
//  FloRod — Sabit veriler
//  Tüm süreler saniye cinsinden (1× hızda). 12 sn = 1 oyun günü.
//  Yaklaşık ölçek: gerçek hayattaki 1 gün ≈ 3 sn.
// =====================================================================

export const SAVE_KEY = 'florod_mushroom_v6';
export const START_MONEY = 25000;
export const BATCH_WEIGHT = 10;          // bir parti = 10 kg substrat
export const SPAWN_PER_BATCH = 0.3;      // parti başına misel (kg) ≈ %3
// Bir arsadaki en fazla konteyner sayısı artık o ilin ilçe sayısıdır (plots.js)
export const NEW_CONTAINER_COST = 30000;

/* ---------- MALZEMELER ---------- */
export const MATERIALS = {
  straw:   { name:'Buğday Samanı',            unit:'kg',   price:5,   icon:'🌾' },
  sawdust: { name:'Sert Ağaç Talaşı',         unit:'kg',   price:6,   icon:'🪵' },
  corncob: { name:'Mısır Koçanı (öğütülmüş)', unit:'kg',   price:3,   icon:'🌽' },
  manure:  { name:'Kanatlı Gübresi',          unit:'kg',   price:4,   icon:'🐔' },
  bran:    { name:'Buğday Kepeği',            unit:'kg',   price:15,  icon:'🥣' },
  peat:    { name:'Torf (Kaplama Toprağı)',   unit:'kg',   price:14,  icon:'🟫' },
  gypsum:  { name:'Alçı (Jips)',              unit:'kg',   price:10,  icon:'🪨' },
  lime:    { name:'Sönmüş Kireç',             unit:'kg',   price:8,   icon:'🧂' },
  spawn:   { name:'Misel (Tohum)',            unit:'kg',   price:150, icon:'🍄' },
  bag:     { name:'Üretim Poşeti',            unit:'adet', price:5,   icon:'🛍️' }
};

/* ---------- PASTÖRİZASYON / STERİLİZASYON YÖNTEMLERİ ----------
   risk   : temel kontaminasyon olasılığı (tür ve iklimle çarpılır)
   duration: temel süre (tür başına prepMult ile çarpılır)               */
export const METHODS = {
  hot:   { name:'Sıcak Su',      icon:'♨️', duration:20, risk:0.15, cost:0,  desc:'60–70°C, 1–2 saat · saman için' },
  lime:  { name:'Kireç Banyosu', icon:'🧪', duration:45, risk:0.08, cost:0,  desc:'%1–2 kireç, 12–24 saat · saman için' },
  steam: { name:'Buhar',         icon:'💨', duration:15, risk:0.05, cost:30, desc:'Buhar ısıtma · talaş ve kompost için' }
};

/* ---------- AŞAMALAR ---------- */
export const PHASES = {
  pasteurizing:{ label:'Pastörizasyon', duration:20 },
  cooling:     { label:'Soğutma', duration:5 },
  cooled:      { label:'Misel Bekliyor', duration:0 },
  incubating:  { label:'Kuluçka', duration:40 },
  pinning:     { label:'Pin Oluşumu', duration:8 },
  fruiting:    { label:'Meyveleme', duration:25 },
  ready:       { label:'Hasada Hazır', duration:0 },
  resting:     { label:'Dinlenme', duration:12 },
  spent:       { label:'Tükendi', duration:0 },
  contaminated:{ label:'Kontamine', duration:0 }
};

/* ---------- MANTAR TÜRLERİ ----------
   recipe       : 10 kg'lık parti için malzeme (substrat toplamı = 10 kg)
   incubation / pinning / fruiting / rest : aşama süreleri (sn)
   flushYield   : her flaş için verim (kg / parti). Dizi uzunluğu = flaş sayısı
   priceMult    : pazardaki referans fiyata (istiridye) göre çarpan
   contamMult   : türün kontaminasyona yatkınlığı
   climateMin   : bu iklim değerinin altında verim düşer (konteyner seviyesi)
   prepMult     : pastörizasyon / hazırlık süresi çarpanı
   coolMult     : soğutma süresi çarpanı
   methodMult   : yöntem uygunluğu (>1 = o yöntemle risk artar)           */
const STRAW_METHODS  = { hot:1,   lime:1,   steam:1   };  // saman: pastörizasyon yeter
const STERILE_NEEDED = { hot:2.5, lime:3,   steam:1   };  // zengin substrat: sterilizasyon gerekir
const COMPOST_METHODS= { hot:2,   lime:2.5, steam:0.8 };  // kompost: kontrollü buhar (Faz II)

export const MUSHROOM_TYPES = {
  oyster: {
    name:'İstiridye Mantarı', latin:'Pleurotus ostreatus', icon:'🍄',
    desc:'Samanda yetişir, güçlü bir koloni kurar. Başlangıç için en güvenli tür.',
    temps:'Kuluçka 22–26°C · Meyve 12–20°C · Nem %85–95',
    recipe:{ straw:8.5, bran:1, lime:0.5, bag:4 },
    incubation:40, pinning:8, fruiting:25, rest:12,
    flushYield:[2.2, 1.3, 0.7],
    priceMult:1.0, fixedPrice:165, contamMult:0.6, climateMin:0.35,
    prepMult:1, coolMult:1, methodMult:STRAW_METHODS
  },
  pink: {
    name:'Pembe İstiridye', latin:'Pleurotus djamor', icon:'🌸',
    desc:'Sıcağı sever, çok hızlı büyür. Soğutma gerekmez ama raf ömrü kısa, fiyatı düşük.',
    temps:'Kuluçka 26–30°C · Meyve 24–30°C',
    recipe:{ straw:9, bran:0.5, lime:0.5, bag:4 },
    incubation:30, pinning:5, fruiting:15, rest:9,
    flushYield:[1.8, 1.0, 0.5],
    priceMult:0.85, fixedPrice:150, contamMult:0.6, climateMin:0.2,
    prepMult:1, coolMult:1, methodMult:STRAW_METHODS
  },
  king: {
    name:'Kral İstiridye', latin:'Pleurotus eryngii', icon:'👑',
    desc:'Talaş + kepek ister; pastörizasyon yetmez, buharla sterilize edilmeli. Yavaş ama değerli.',
    temps:'Kuluçka 22–25°C · Meyve 12–18°C · Nem %85–90',
    recipe:{ sawdust:7, bran:2.5, gypsum:0.5, bag:4 },
    incubation:85, pinning:28, fruiting:35, rest:30,
    flushYield:[1.8, 0.9],
    priceMult:2.6, fixedPrice:650, contamMult:1.0, climateMin:0.5,
    prepMult:1.5, coolMult:1.5, methodMult:STERILE_NEEDED
  },
  shiitake: {
    name:'Shiitake', latin:'Lentinula edodes', icon:'🍂',
    desc:'Meşe talaşında çok uzun kuluçka (kahverengileşme dahil) ister; soğuk şokla meyve verir.',
    temps:'Kuluçka 22–25°C · Soğuk şok 8–12°C · Meyve 12–20°C',
    recipe:{ sawdust:8, bran:1.5, gypsum:0.5, bag:4 },
    incubation:150, pinning:15, fruiting:30, rest:40,
    flushYield:[1.8, 1.2, 0.7],
    priceMult:2.9, fixedPrice:2200, contamMult:1.4, climateMin:0.72,
    prepMult:1.6, coolMult:1.5, methodMult:STERILE_NEEDED
  },
  agaricus: {
    name:'Beyaz Şapkalı (Champignon)', latin:'Agaricus bisporus', icon:'⚪',
    desc:'Saman + gübre kompostu uzun hazırlanır; misel sürüşünden sonra torfla kaplanır. Poşet yerine raf/tepsi kullanılır.',
    temps:'Misel sürüşü 24–25°C · Meyve 16–18°C · Nem %85–90',
    recipe:{ straw:4.5, manure:4, gypsum:0.5, peat:1 },
    incubation:55, pinning:20, fruiting:14, rest:8,
    flushYield:[2.2, 1.2, 0.7],
    priceMult:1.0, fixedPrice:450, contamMult:1.1, climateMin:0.5,
    prepMult:2, coolMult:1.5, methodMult:COMPOST_METHODS
  },
  enoki: {
    name:'Enoki', latin:'Flammulina velutipes', icon:'🥢',
    desc:'Soğuk sever; düşük sıcaklıkta uzun, ince saplı meyve verir. Çok iyi iklim kontrolü şart.',
    temps:'Kuluçka 20–22°C · Meyve 5–10°C',
    recipe:{ sawdust:4.5, corncob:3, bran:2, gypsum:0.5, bag:4 },
    incubation:65, pinning:30, fruiting:30, rest:25,
    flushYield:[2.0, 0.8],
    priceMult:2.4, fixedPrice:10500, contamMult:1.3, climateMin:0.88,
    prepMult:1.5, coolMult:1.5, methodMult:STERILE_NEEDED
  },
  lions: {
    name:'Aslan Yelesi', latin:'Hericium erinaceus', icon:'🦁',
    desc:'Sert ağaç talaşında hızlı kolonize olan şifalı bir tür. Yüksek nem ve temiz hava sever.',
    temps:'Kuluçka 22–24°C · Meyve 15–20°C · Nem %90+',
    recipe:{ sawdust:7.5, bran:2, gypsum:0.5, bag:4 },
    incubation:50, pinning:15, fruiting:30, rest:20,
    flushYield:[1.8, 1.0],
    priceMult:2.0, fixedPrice:2000, contamMult:1.1, climateMin:0.72,
    prepMult:1.5, coolMult:1.5, methodMult:STERILE_NEEDED
  }
};

/* ---------- PİYASA REFERANSI (istiridye) ---------- */
export const RECIPE = MUSHROOM_TYPES.oyster.recipe;   // eski kodla uyumluluk
export function recipeCost(recipe) {
  let c = SPAWN_PER_BATCH * MATERIALS.spawn.price;
  for (const [k, q] of Object.entries(recipe)) c += MATERIALS[k].price * q;
  return c;
}
export const BASE_RECIPE_COST = recipeCost(RECIPE);
export const BATCH_YIELD_TOTAL = MUSHROOM_TYPES.oyster.flushYield.reduce((a, b) => a + b, 0);
export const BATCH_YIELD_AVG = BATCH_YIELD_TOTAL / MUSHROOM_TYPES.oyster.flushYield.length;

/* ---------- KONTEYNER SEVİYELERİ ---------- */
export const CONTAINER_LEVELS = [
  null,
  { name:'20ft Temel Konteyner', capacity:50,  storage:100,  climate:0.35, priceBonus:0,    cost:0 },
  { name:'Yalıtım + 4 Kat Raf',  capacity:150, storage:300,  climate:0.50, priceBonus:0,    cost:45000 },
  { name:'İklimlendirme (AC+Nem+Fan)', capacity:150, storage:300, climate:0.72, priceBonus:0, cost:125000 },
  { name:'HEPA + Otomasyon',     capacity:250, storage:500,  climate:0.88, priceBonus:0,    cost:350000 },
  { name:'Soğuk Hava + Otomasyon', capacity:500, storage:1000, climate:0.95, priceBonus:0.10, cost:900000 }
];

/* ---------- USTALAR ---------- */
export const MASTER_TYPES = {
  inoculate: { name: 'Aşılama Ustası', icon: '💉' },
  harvest:   { name: 'Hasat Ustası',   icon: '🍄' }
};
export const STAR_SPEED  = { 1: 1.0, 2: 1.15, 3: 1.35, 4: 1.6, 5: 2.0 };
export const STAR_SALARY = { 1: 2, 2: 5, 3: 10, 4: 20, 5: 35 };

export const RESTART_MODES = {
  stop:    { name: 'Durdur',                  desc: 'Parti bitince yeni parti başlatılmaz.' },
  ifhave:  { name: 'Malzeme Varsa Başlat',    desc: 'Malzeme varsa seçili yöntemle yeni parti başlat.' },
  autobuy: { name: 'Para Varsa Otomatik Al',  desc: 'Eksik malzemeyi satın alır, sonra yeni parti başlatır.' }
};

export const MALE_NAMES = [
  'Ahmet','Mehmet','Mustafa','Ali','Hüseyin','Hasan','Murat','Ömer','Yusuf','İbrahim',
  'Halil','İsmail','Osman','Ramazan','Süleyman','Kemal','Fatih','Emre','Burak','Serkan',
  'Cem','Barış','Tolga','Kaan','Onur','Volkan','Erdem','Selim','Cengiz','Yaşar',
  'Sait','Rıza','Recep','Salih','Sami','Kadir','Uğur','Yavuz','Zeki','Nuri',
  'Sedat','Tayfun','Metin','Levent','Ergün','Fikret','Gökhan','Koray','Taner','Yiğit'
];
export const SURNAMES = [
  'Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir',
  'Arslan','Doğan','Kılıç','Aslan','Çetin','Kara','Koç','Kurt','Özkan','Şimşek',
  'Polat','Özcan','Korkmaz','Çakır','Erdoğan','Yalçın','Güneş','Bulut','Güven','Aktaş',
  'Tekin','Akgün','Tunç','Uçar','Bozkurt','Kaplan','Yavuz','Sarı','Keskin','Korkut'
];
