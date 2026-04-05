// casa-romeu/property.ts
// Static property data for Casa de Romeu, Valencia.

import type { Property } from '../../../lib/programmeTypes'

export const casaRomeu: Property = {
  id:       'casa-romeu',
  name:     'Casa de Romeu',
  tagline:  'Stay in in one of the world\'s most liveable cities.',
  location: 'Ruzafa, Valencia, Spain',
  heroImage: '/programme/stays/casa-romeu/hero.jpg',

  photos: [
    { src: '/programme/stays/casa-romeu/bedroom.webp',       caption: 'Main Bedroom' },
    { src: '/programme/stays/casa-romeu/bedroom2.webp',      caption: 'Second Bedroom' },
    { src: '/programme/stays/casa-romeu/dining.webp',        caption: 'Dining Room' },
    { src: '/programme/stays/casa-romeu/kitchen.webp',       caption: 'Kitchen' },
    { src: '/programme/stays/casa-romeu/main-bathroom-b.webp', caption: 'Main Bathroom' },
    { src: '/programme/stays/casa-romeu/half-bathroom.webp', caption: 'Half Bathroom' },
    { src: '/programme/stays/casa-romeu/livingroom1.webp',   caption: 'Living Room' },
    { src: '/programme/stays/casa-romeu/livingroom2.webp',   caption: 'Living Room & Library' },
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