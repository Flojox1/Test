export const PHASE_IMAGES = {
  pasteurizing: 'images/1.jpg',
  cooling: 'images/2.jpg',
  cooled: 'images/3.jpg',
  incubating: 'images/4.jpg',
  pinning: 'images/5.jpg',
  fruiting: 'images/6.jpg',
  ready: 'images/7.jpg',
  resting: 'images/8.jpg',
  contaminated: 'images/9.jpg',
  spent: 'images/10.jpg',
  container: 'images/container.jpg'
};

export function getFrame(phase) {
  return PHASE_IMAGES[phase] || PHASE_IMAGES.container;
}
