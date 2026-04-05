// casa-romeu/houseManual.ts
// Full house manual content for Casa de Romeu.

import type { ManualSection } from '../../../lib/programmeTypes'

export const houseManual: ManualSection[] = [
  {
    id:    'entry-keys',
    title: 'Entry & Keys',
    icon:  '🔑',
    content: [
      {
        type: 'paragraph',
        text: 'Your key ring has two keys: a small silver key for the building entry door (Key A), and a large key for the condo entry (Key B).',
      },
      { type: 'heading', text: 'Key A — Building Entry' },
      {
        type: 'paragraph',
        text: 'Requires a quarter-turn anti-clockwise to unlock. It can be sticky — a slight upward pressure as you turn usually helps. The door tends to slam; please close it gently.',
      },
      { type: 'heading', text: 'Key B — Condo Entry' },
      {
        type: 'paragraph',
        text: 'Turn left two or four times, then a quarter turn to open. When leaving, turn clockwise 2 or 4 times to re-engage the deadbolts.',
      },
      {
        type: 'note',
        text: 'We suggest always locking the door from the inside and placing keys on the hook behind the door — you cannot leave without a key in hand.',
      },
      {
        type: 'warning',
        text: 'Never leave a key in the inside lock. The door cannot be opened from outside in this circumstance, even in an emergency. Keys cost nearly €50 each to replace — any lost keys will be deducted from your deposit.',
      },
    ],
  },
  {
    id:    'alarm',
    title: 'Alarm',
    icon:  '🔒',
    content: [
      {
        type: 'paragraph',
        text: 'You\'ll be given a 4-digit alarm code. Please use it any time you\'re away overnight or out for more than a few hours. For short trips (market, coffee, groceries), it\'s not necessary.',
      },
      {
        type: 'note',
        text: 'The camera in the entryway is disabled while the alarm is off — for your privacy. Feel free to unplug it while home. Please plug it back in before departing each day.',
      },
      {
        type: 'warning',
        text: 'Please do not interact with the alarm box in the living room — it may trigger a response from local authorities.',
      },
    ],
  },
  {
    id:    'wifi',
    title: 'WiFi',
    icon:  '📶',
    content: [
      {
        type: 'wifi',
        network:  'CasaRomeu_Guests',
        password: 'Romeu2026',
      },
      {
        type: 'note',
        text: 'There is a WiFi extender on the floor of the main bedroom — please don\'t touch or adjust it. We reserve the right to update the password; you\'ll always be kept informed.',
      },
    ],
  },
  {
    id:    'heating-water',
    title: 'Heat & Hot Water',
    icon:  '🌡️',
    content: [
      {
        type: 'paragraph',
        text: 'All hot water and central heating run from the same tank, located in the 2nd bathroom (half-bath) down the hallway. Please do not adjust any settings.',
      },
      {
        type: 'paragraph',
        text: 'The system requires pressure between 0.8–1.1 bar. If it de-pressurises during your stay, gently turn the blue knob underneath the tank clockwise — release once it reaches 0.8 bar on the screen.',
      },
      {
        type: 'heading',
        text: 'Central Heating',
      },
      {
        type: 'paragraph',
        text: 'Controlled by the white square device to the left of the TV. Press the up/down arrow to adjust. Please set it below 18°C whenever you leave the apartment.',
      },
    ],
  },
  {
    id:    'aircon',
    title: 'Air Conditioning',
    icon:  '❄️',
    content: [
      {
        type: 'paragraph',
        text: 'The dining room and main bedroom both have minisplit aircon units. Use the remotes freely — set the temperature as you wish.',
      },
      {
        type: 'note',
        text: 'Radiators are preferred for heating. For cooling, the minisplits are your only option. Please close windows and doors when using heating or aircon.',
      },
    ],
  },
  {
    id:    'windows',
    title: 'Windows & Balcony Doors',
    icon:  '🪟',
    content: [
      {
        type: 'heading',
        text: 'Dining Room & Bathrooms',
      },
      {
        type: 'list',
        items: [
          'Quarter-turn handle: opens the door or window fully',
          'Half-turn handle: opens the top panel only',
        ],
      },
      {
        type: 'heading',
        text: 'Kitchen, Living Room & Bedroom',
      },
      {
        type: 'list',
        items: [
          'Push the locking tab down and slide left or right',
        ],
      },
    ],
  },
  {
    id:    'bathrooms',
    title: 'Bathrooms & Showers',
    icon:  '🚿',
    content: [
      {
        type: 'paragraph',
        text: 'Bathrooms are equipped with soap and shampoo — feel free to supplement with your own. The shower has a water filter to remove particles from city water.',
      },
      {
        type: 'warning',
        text: 'Please only flush toilet paper, tissue, and human waste. All other sanitary products go in the waste bucket.',
      },
    ],
  },
  {
    id:    'washing-machine',
    title: 'Washing Machine',
    icon:  '🫧',
    content: [
      {
        type: 'paragraph',
        text: 'Located in the primary bathroom. Full directions are on a blue sheet on top of the machine.',
      },
      {
        type: 'list',
        items: [
          'Press the top-right button gently to power on',
          'Load your clothes',
          'Add detergent to the cap — it can go directly in with clothes',
          'Use the 15-minute quick wash cycle (default, do not change)',
        ],
      },
      {
        type: 'warning',
        text: 'Do not put shoes or large items in the machine. Any damage will be deducted from your deposit.',
      },
    ],
  },
  {
    id:    'drying',
    title: 'Drying Clothes',
    icon:  '🧺',
    content: [
      {
        type: 'paragraph',
        text: 'There is a clothes line outside the bedrooms with plenty of pegs. An inside rack is also available.',
      },
    ],
  },
  {
    id:    'kitchen',
    title: 'Kitchen',
    icon:  '🍳',
    content: [
      {
        type: 'paragraph',
        text: 'The kitchen is fully functional — use everything freely. Feel free to use any condiments or spices you find. If you finish a container, please replace it as a courtesy.',
      },
      {
        type: 'list',
        items: [
          'Do not place hot pans directly on the counter — trivets are in the drawer',
          'Always use a cutting board, especially with sharp knives',
          'The tile floor is slippery when wet — wipe spills immediately',
          'Hot water may take a few seconds — the tank is in the 2nd bathroom',
        ],
      },
      {
        type: 'note',
        text: 'Help yourself to anything in the fridge or freezer. We\'ve left a welcome arrangement of Spanish snacks and cold beers for your arrival. Please dispose of any perishables you purchase before checkout.',
      },
    ],
  },
  {
    id:    'water',
    title: 'Purified Water',
    icon:  '💧',
    content: [
      {
        type: 'paragraph',
        text: 'New in 2025 — the kitchen has a reverse-osmosis system. The silver faucet closest to you.',
      },
      {
        type: 'list',
        items: [
          'Pull handle toward you — purified drinking water',
          'Push handle away from you — filtered water for washing produce',
        ],
      },
      {
        type: 'warning',
        text: 'Do not use this system for washing dishes, hands, or clothes. For the environment, we recommend filling the large jug next to the oven rather than using plastic bottles.',
      },
    ],
  },
  {
    id:    'dishwasher',
    title: 'Dishwasher',
    icon:  '🍽️',
    content: [
      {
        type: 'paragraph',
        text: 'Please don\'t overload it — it\'s over 5 years old. Tabs are under the sink. Use the quick wash (#3 on the dial, ~1 hour). Let it complete its cycle, then turn the dial to off.',
      },
      {
        type: 'warning',
        text: 'Be careful opening the corner cupboard next to the dishwasher — ensure the dishwasher is fully closed first, or it can knock the dial off.',
      },
    ],
  },
  {
    id:    'oven',
    title: 'Oven',
    icon:  '🔥',
    content: [
      {
        type: 'paragraph',
        text: 'Brand new as of November 2025. Two-dial system: left dial sets the heating style (2 o\'clock position is recommended), right dial sets the temperature.',
      },
      {
        type: 'warning',
        text: 'Set both dials to the 12 o\'clock position (off) and pushed in when finished. Do not use the cleaning function without checking with us first.',
      },
    ],
  },
  {
    id:    'tv',
    title: 'TV & Entertainment',
    icon:  '📺',
    content: [
      {
        type: 'paragraph',
        text: 'Smart TV ready for your stay. You may need to switch on the power strip next to the blue model car. The power button can be finicky — a couple of attempts may be needed.',
      },
      {
        type: 'note',
        text: 'Feel free to sign into Netflix or any streaming service. Please remember to sign out before you leave. There\'s also a DVD player under the TV with its own remote — speakers only work with the DVD player.',
      },
    ],
  },
  {
    id:    'power',
    title: 'Power Adapters',
    icon:  '🔌',
    content: [
      {
        type: 'paragraph',
        text: 'Spain uses Type C (Euro-plug). You\'ll find an assortment of adapters in the drawer under the entryway mirror.',
      },
      {
        type: 'note',
        text: 'Please return all adapters on departure — it\'s not fair to future guests if they go missing.',
      },
    ],
  },
  {
    id:    'trash',
    title: 'Trash & Recycling',
    icon:  '♻️',
    content: [
      {
        type: 'paragraph',
        text: 'Spain has a well-organised waste separation system. In the kitchen you\'ll find two bins: large (general waste) and small (food waste — fruit, veg, nuts).',
      },
      {
        type: 'heading',
        text: 'Outside Bins',
      },
      {
        type: 'list',
        items: [
          'Gray — general waste',
          'Brown — food/organic waste',
          'Blue — cardboard',
          'Yellow — plastic containers and cartons',
          'Green (pyramid) — glass',
        ],
      },
      {
        type: 'note',
        text: 'If you don\'t see all bins immediately outside, take a left from the building then the first right — there are usually bins one block away.',
      },
    ],
  },
  {
    id:    'plant',
    title: 'Toby\'s Tree',
    icon:  '🌱',
    content: [
      {
        type: 'paragraph',
        text: 'The tree has been in the living room for many years. A dose of water once a week would be greatly appreciated.',
      },
    ],
  },
]