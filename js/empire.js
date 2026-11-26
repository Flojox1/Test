// =====================================================================
// FloRod — Illegal Empire Simulator temel veri modeli
// Bu modül mevcut mantar oyunundan bağımsızdır; geçiş ekranı bağlanana
// kadar mevcut oyun akışını veya kayıtları değiştirmez.
// =====================================================================

export const CHARACTER_START_AGE = 18;
export const CHARACTER_STAT_MIN = 0;
export const CHARACTER_STAT_MAX = 100;
export const CHARACTER_START_STAT = 20;
export const INHERITANCE_RATE = 0.5;

export const CHARACTER_STATS = Object.freeze({
  strength: 'Güç',
  charisma: 'Karizma',
  intelligence: 'Zekâ',
  knowledge: 'Bilgi',
  agility: 'Çeviklik',
  endurance: 'Dayanıklılık',
  leadership: 'Liderlik',
  persuasion: 'İkna'
});

export const TALENT_BRANCHES = Object.freeze({
  physical: {
    name: 'Fiziksel',
    description: 'Güç, çeviklik ve dayanıklılık gelişimi.',
    stats: ['strength', 'agility', 'endurance']
  },
  social: {
    name: 'Sosyal',
    description: 'Karizma, ikna ve sosyal etkileşim gelişimi.',
    stats: ['charisma', 'persuasion']
  },
  mental: {
    name: 'Zihinsel',
    description: 'Zekâ, bilgi ve analiz gelişimi.',
    stats: ['intelligence', 'knowledge']
  },
  management: {
    name: 'Yönetim',
    description: 'Liderlik ve işletme yönetimi gelişimi.',
    stats: ['leadership']
  },
  lifestyle: {
    name: 'Yaşam',
    description: 'Sağlık, ihtiyaçlar ve stres yönetimi.',
    stats: ['health', 'stressResistance']
  }
});

export const CHARACTER_NEEDS = Object.freeze({
  hunger: { name: 'Açlık', initial: 100 },
  thirst: { name: 'Susuzluk', initial: 100 },
  energy: { name: 'Enerji', initial: 100 },
  sleep: { name: 'Uyku', initial: 100 },
  health: { name: 'Sağlık', initial: 100 },
  stress: { name: 'Stres', initial: 0 }
});

// Başlangıç şehirleri; mahalle listeleri şehir/harita aşamasında genişletilecek.
export const START_CITIES = Object.freeze([
  { id: 'istanbul', name: 'İstanbul' },
  { id: 'ankara', name: 'Ankara' },
  { id: 'izmir', name: 'İzmir' },
  { id: 'antalya', name: 'Antalya' },
  { id: 'bursa', name: 'Bursa' },
  { id: 'adana', name: 'Adana' }
]);

export function createCharacter({ name = 'Yeni Karakter', generation = 1 } = {}) {
  const stats = Object.fromEntries(
    Object.keys(CHARACTER_STATS).map(key => [key, CHARACTER_START_STAT])
  );
  return {
    id: crypto.randomUUID(),
    name,
    age: CHARACTER_START_AGE,
    generation,
    stats,
    needs: Object.fromEntries(
      Object.entries(CHARACTER_NEEDS).map(([key, need]) => [key, need.initial])
    ),
    talents: {},
    education: [],
    createdAt: Date.now(),
    alive: true
  };
}

export function createEmpireState() {
  return {
    unlocked: false,
    transitionOffer: {
      available: false,
      purchased: false,
      price: null
    },
    world: {
      cityId: null,
      districtId: null,
      propertyId: null
    },
    character: null,
    estate: {
      cash: 0,
      bank: 0,
      properties: [],
      vehicles: [],
      businesses: [],
      otherAssets: []
    },
    history: {
      generation: 0,
      previousCharacters: []
    }
  };
}

export function clampCharacterStat(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return CHARACTER_STAT_MIN;
  return Math.max(CHARACTER_STAT_MIN, Math.min(CHARACTER_STAT_MAX, number));
}

// Ölümde karakter özellikleri aktarılmaz; yalnızca toplam mal varlığının
// belirlenen oranı yeni karaktere miras kalır. Devir işlemi çağıran sistemce yapılır.
export function calculateInheritance(totalEstateValue) {
  const value = Math.max(0, Number(totalEstateValue) || 0);
  return Math.floor(value * INHERITANCE_RATE);
}
