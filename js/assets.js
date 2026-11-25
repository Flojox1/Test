// Senin atacağın fotoğrafların yolları. 
// İsimleri birebir böyle yap veya buradan değiştir.
export const PHASE_IMAGES = {
  pasteurizing: 'images/pasteurizing.jpg',
  cooling: 'images/cooling.jpg',
  cooled: 'images/cooled.jpg',
  incubating: 'images/incubating.jpg',
  pinning: 'images/pinning.jpg',
  fruiting: 'images/fruiting.jpg',
  ready: 'images/ready.jpg',
  resting: 'images/resting.jpg',
  contaminated: 'images/contaminated.jpg',
  spent: 'images/spent.jpg',
  container: 'images/container.jpg'
};

// Aşamaya göre resmi döndürür
export function getFrame(phase) {
  return PHASE_IMAGES[phase] || PHASE_IMAGES.container;
}
