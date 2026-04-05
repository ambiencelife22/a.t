// casa-romeu/property.ts
// Static property data for Casa de Romeu, Valencia.

import type { Property } from '../../../lib/tripsTypes'

export const casaRomeu: Property = {
  id:       'casa-romeu',
  name:     'Casa de Romeu',
  tagline:  'A favourite piso in one of the world\'s most liveable cities.',
  location: 'Ruzafa, Valencia, Spain',
  heroImage: '/trips/casa-romeu/hero.jpg',

  photos: [
    '/trips/casa-romeu/bedroom.webp',
    '/trips/casa-romeu/livingroom1.webp',
    '/trips/casa-romeu/livingroom2.webp',
  ],

  owner: {
    name:  'Deron',
    phone: '+34 623 93 61 27',
    role:  'Owner',
  },

  manager: {
    name:  'Soraya',
    phone: '+34 622 89 70 44',
    role:  'Property Manager',
  },

  emergencies: [
    { label: 'Fire, Police, Ambulance', phone: '112' },
    { label: 'Gas Supply',              phone: '+34 900 750 750' },
    { label: 'Electricity Supply',      phone: '+34 900 171 171' },
    { label: 'Water Supply',            phone: '+34 963 860 638' },
  ],
}