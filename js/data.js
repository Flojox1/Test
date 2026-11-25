export const SAVE_KEY = 'florod_mushroom_v5';
export const START_MONEY = 2500;
export const BATCH_WEIGHT = 10;
export const MAX_CONTAINERS = 5;
export const NEW_CONTAINER_COST = 30000;

export const MATERIALS = {
  straw:  { name:'Buğday Samanı',  unit:'kg',   price:5,   icon:'🌾' },
  bran:   { name:'Buğday Kepeği',  unit:'kg',   price:15,  icon:'🌾' },
  gypsum: { name:'Alçı',           unit:'kg',   price:10,  icon:'🪨' },
  lime:   { name:'Sönmüş Kireç',   unit:'kg',   price:8,   icon:'🧂' },
  spawn:  { name:'Misel',          unit:'kg',   price:150, icon:'🍄' },
  bag:    { name:'Poşet',          unit:'adet', price:5,   icon:'🛍️' }
};
export const RECIPE = { straw:7, bran:2, gypsum:0.5, lime:0.5, bag:4 };
export const BASE_RECIPE_COST = 7*5 + 2*15 + 0.5*10 + 0.5*8 + 4*5; // 139
export const BATCH_YIELD_TOTAL = 4; // 2.2 + 1.2 + 0.6
export const BATCH_YIELD_AVG = BATCH_YIELD_TOTAL / 3;

export const METHODS = {
  hot:   { name:'Sıcak Su',      icon:'♨️', duration:20, risk:0.15, cost:0,  desc:'60–70°C, 2–3 saat' },
  lime:  { name:'Kireç Banyosu', icon:'🧪', duration:45, risk:0.08, cost:0,  desc:'%1–2 kireç, 12–24 saat' },
  steam: { name:'Buhar',         icon:'💨', duration:15, risk:0.05, cost:30, desc:'80°C, 2 saat' }
};

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

export const CONTAINER_LEVELS = [
  null,
  { name:'20ft Temel Konteyner', capacity:50,  storage:100,  climate:0.35, priceBonus:0,    cost:0 },
  { name:'Yalıtım + 4 Kat Raf',  capacity:150, storage:300,  climate:0.50, priceBonus:0,    cost:12000 },
  { name:'İklimlendirme (AC+Nem+Fan)', capacity:150, storage:300, climate:0.72, priceBonus:0, cost:30000 },
  { name:'HEPA + Otomasyon',     capacity:250, storage:500,  climate:0.88, priceBonus:0,    cost:65000 },
  { name:'Soğuk Hava + Otomasyon', capacity:500, storage:1000, climate:0.95, priceBonus:0.10, cost:140000 }
];

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
