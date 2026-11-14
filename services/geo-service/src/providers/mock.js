/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/providers/mock.js – offline, deterministic geocoder for tests and demos
 */

/** Known places around Kochi and Kozhikode (approximate real coordinates). */
const PLACES = [
  { keys: ['mg road', 'kochi'], lat: 9.9658, lng: 76.2856, displayName: 'MG Road, Ernakulam, Kochi, Kerala, India' },
  { keys: ['edappally'], lat: 10.0261, lng: 76.3125, displayName: 'Edappally, Kochi, Kerala, India' },
  { keys: ['kakkanad'], lat: 10.0159, lng: 76.3419, displayName: 'Kakkanad, Kochi, Kerala, India' },
  { keys: ['infopark'], lat: 10.0098, lng: 76.3636, displayName: 'Infopark, Kakkanad, Kochi, Kerala, India' },
  { keys: ['fort kochi'], lat: 9.9658, lng: 76.2421, displayName: 'Fort Kochi, Kochi, Kerala, India' },
  { keys: ['vyttila'], lat: 9.9674, lng: 76.3185, displayName: 'Vyttila Mobility Hub, Kochi, Kerala, India' },
  { keys: ['aluva'], lat: 10.1076, lng: 76.3516, displayName: 'Aluva, Ernakulam, Kerala, India' },
  { keys: ['kozhikode beach'], lat: 11.2553, lng: 75.7726, displayName: 'Kozhikode Beach, Kozhikode, Kerala, India' },
  { keys: ['mavoor road'], lat: 11.2588, lng: 75.79, displayName: 'Mavoor Road, Kozhikode, Kerala, India' },
  { keys: ['kozhikode', 'calicut'], lat: 11.2588, lng: 75.7804, displayName: 'Kozhikode, Kerala, India' },
];

function lookup(address) {
  const text = String(address).toLowerCase();
  // Most specific match first: the entry whose longest key appears in the text.
  let best = null;
  PLACES.forEach((place) => {
    place.keys.forEach((key) => {
      if (text.includes(key) && (!best || key.length > best.len)) best = { place, len: key.length };
    });
  });
  return best ? best.place : null;
}

module.exports = {
  name: 'mock',
  PLACES,

  async geocode(address) {
    const place = lookup(address);
    return place ? { lat: place.lat, lng: place.lng, displayName: place.displayName } : null;
  },

  async reverse(lat, lng) {
    // Nearest known place (simple squared-degree distance is fine for a mock).
    const nearest = PLACES.reduce((acc, p) => {
      const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
      return !acc || d < acc.d ? { p, d } : acc;
    }, null);
    return { displayName: `Near ${nearest.p.displayName}`, address: { mock: true } };
  },
};
