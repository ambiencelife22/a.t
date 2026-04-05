// casa-romeu/property.ts
// Static property data for Casa de Romeu, Valencia.

import type { Property } from '../../../lib/programmeTypes'

export const casaRomeu: Property = {
  id:       'casa-romeu',
  name:     'Casa de Romeu',
  tagline:  'A favourite piso in one of the world\'s most liveable cities.',
  location: 'Ruzafa, Valencia, Spain',
  heroImage: '/programme/stays/casa-romeu/hero.jpg',

  photos: [
    { src: '/programme/stays/casa-romeu/bedroom.webp',         caption: 'Main Bedroom',         subCaption: 'Bed, Desk, Dressers, Closet' },
    { src: '/programme/stays/casa-romeu/bedroom2.webp',        caption: 'Second Bedroom',        subCaption: 'Twin Beds, Dresser, & Wardrobe' },
    { src: '/programme/stays/casa-romeu/dining.webp',          caption: 'Dining Room',           subCaption: 'Seats Six, Air Conditioning' },
    { src: '/programme/stays/casa-romeu/kitchen-a.webp',         caption: 'Kitchen',               subCaption: 'Fully Stocked & Many Appliances' },
    { src: '/programme/stays/casa-romeu/main-bathroom-b.webp', caption: 'Main Bathroom',         subCaption: 'Shower, Toilet, Sink, & Washing Machine' },
    { src: '/programme/stays/casa-romeu/half-bathroom.webp',   caption: 'Half Bathroom',         subCaption: 'Toilet, Sink, Hot Water Heater' },
    { src: '/programme/stays/casa-romeu/livingroom1.webp',     caption: 'Living Room',           subCaption: 'Sofa, Armchairs & Smart TV' },
    { src: '/programme/stays/casa-romeu/livingroom2.webp',     caption: 'Living Room & Library', subCaption: 'Books, DVDs & Reading Corner' },
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