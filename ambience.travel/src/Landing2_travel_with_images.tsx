
export default function App() {
  const highlights = [
    'Personally guided, never mass-market',
    'Refined, calm, and emotionally intelligent',
    'Built on trust, discretion, and taste',
    'Designed for memorable experiences, not just movement',
  ]

  const editorialGallery = [
    {
      title: 'Exceptional Suites & Villas',
      subtitle: 'Oceanfront villas, grand suites, and private sanctuaries selected for beauty, comfort, and feeling.',
      image:
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Private Air & Arrivals',
      subtitle: 'From private jet moments to smooth airport support, movement should feel seamless from the outset.',
      image:
        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Dining & Atmosphere',
      subtitle: 'Thoughtful tables, beautiful rooms, and places that make the evening feel worth remembering.',
      image:
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Wellnesscapes',
      subtitle: 'Restorative escapes shaped around rhythm, privacy, beauty, and a deeper exhale.',
      image:
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80',
    },
  ]

  const pillars = [
    {
      title: 'Travel Design',
      text: 'Thoughtfully composed journeys built around your pace, preferences, and the feeling you want the experience to leave behind.',
    },
    {
      title: 'Lifestyle Management',
      text: 'Support that extends beyond bookings, with a more intuitive layer of coordination, responsiveness, and personal care.',
    },
    {
      title: 'Private Concierge',
      text: 'Discreet, relationship-led assistance for those who value trust, detail, and a highly tailored level of service.',
    },
  ]

  const journeyMoments = [
    {
      title: 'Before You Leave',
      text: 'Clear options, thoughtful guidance, and a planning process that feels calm from the start.',
    },
    {
      title: 'On Arrival',
      text: 'Smooth transitions, beautiful welcomes, and less friction where it matters most.',
    },
    {
      title: 'During the Stay',
      text: 'A more personal layer of support, with memorable experiences shaped around your preferences.',
    },
    {
      title: 'Afterward',
      text: 'The kind of journey that lingers — not just because it was beautiful, but because it felt right.',
    },
  ]

  const experienceTypes = [
    {
      title: 'Romantic Getaways',
      text: 'Elegant escapes designed around connection, atmosphere, and memorable shared moments.',
      image:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Celebratory Travel',
      text: 'Milestones, birthdays, anniversaries, and once-in-a-lifetime journeys handled with care and intention.',
      image:
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Wellness-Led Escapes',
      text: 'Journeys that balance restoration, design, privacy, and a deeper sense of wellbeing.',
      image:
        'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Urban Indulgence',
      text: 'Beautiful city stays with exceptional rooms, refined service, and a sharper sense of access.',
      image:
        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Slow, Restorative Retreats',
      text: 'Calmer, slower journeys for those wanting space, beauty, and a stronger connection to place.',
      image:
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: 'Private Villas & Signature Suites',
      text: 'Exceptional spaces chosen not just for prestige, but for how they feel to arrive to and live in.',
      image:
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    },
  ]

  const hospitalityMoments = [
    {
      title: 'Hotels, Villas & Suites',
      text: 'Selected for more than reputation alone — beauty, service, privacy, and atmosphere all have to land.',
      image:
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80',
    },
    {
      title: 'Dining, Atmosphere & Access',
      text: 'From quietly exceptional breakfasts to memorable evenings, the best tables are part of the story.',
      image:
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=80',
    },
    {
      title: 'Private Air, Ground & Support',
      text: 'Seamless movement matters. The details around the journey should feel smooth, discreet, and considered.',
      image:
        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1400&q=80',
    },
  ]

  return (
    <main className='min-h-screen bg-[#FAF8F6] text-[#1A1D1A]'>
      <div style={{ minHeight: '100vh', background: '#FAF8F6', color: '#1A1D1A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'rgba(250,248,246,0.88)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid #E8E2DA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 clamp(20px,5vw,48px)',
            height: 56,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src='/emblem.png' alt='ambience emblem' style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
            <img src='/logo.png' alt='ambience.travel' style={{ height: 18, width: 'auto' }} />
          </div>

          <button
            disabled
            aria-disabled='true'
            className='cursor-not-allowed rounded-full bg-[#A8AAA8] px-[18px] py-[7px] text-[13px] font-semibold tracking-[0.01em] text-[#FAF8F6] opacity-70'
          >
            Inquire
          </button>
        </nav>

        <section className='relative overflow-hidden border-b border-[#D8D2C8] bg-[radial-gradient(circle_at_top_left,rgba(232,197,71,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(90,106,90,0.12),transparent_24%),linear-gradient(to_bottom,#faf8f6,#f4efe8)]'>
          <div className='absolute inset-0 opacity-40'>
            <div className='absolute left-[8%] top-20 h-40 w-40 rounded-full bg-[#E8C547]/25 blur-3xl' />
            <div className='absolute right-[8%] top-24 h-48 w-48 rounded-full bg-[#5A6A5A]/15 blur-3xl' />
          </div>

          <div className='relative mx-auto grid max-w-7xl gap-14 px-6 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 lg:py-24'>
            <div className='max-w-3xl'>
              <div className='mb-6 flex items-center gap-3'>
                <div className='flex shrink-0 items-center gap-3 rounded-full px-3 py-2 backdrop-blur-sm'>
                  <img src='/emblem.png' alt='ambience emblem' className='h-8 w-8 shrink-0 rounded-full object-cover' />
                  <div className='w-[170px] shrink-0 sm:w-[210px]'>
                    <img src='/logo.png' alt='ambience.travel logo' className='block h-auto w-full object-contain' />
                  </div>
                </div>
              </div>

              <h1 className='mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-[#1A1D1A] sm:text-6xl lg:text-7xl'>
                Meaningful travel,
                <span className='block text-[#5A6A5A]'>thoughtfully designed.</span>
              </h1>

              <p className='mt-6 max-w-2xl text-lg leading-8 text-[#555B55] sm:text-xl'>
                Beautiful journeys shaped with taste, care, and a more personal standard of service — from exceptional stays
                and discreet support to wellness-minded escapes and memorable moments that linger.
              </p>

              <div className='mt-10 flex flex-wrap gap-4'>
                <button
                  disabled
                  aria-disabled='true'
                  className='cursor-not-allowed rounded-full bg-[#1A1D1A] px-6 py-3 text-sm font-semibold text-[#FAF8F6] opacity-80 shadow-none'
                >
                  Begin the Conversation
                </button>

                <button
                  disabled
                  aria-disabled='true'
                  className='cursor-not-allowed rounded-full border border-[#D8D2C8] bg-[#F3F1EC] px-6 py-3 text-sm font-semibold text-[#5A6A5A] opacity-90'
                >
                  Explore Experiences
                </button>
              </div>

              <div className='mt-12 grid gap-4 sm:grid-cols-2'>
                {highlights.map((item) => (
                  <div
                    key={item}
                    className='rounded-2xl border border-[#DDD6CA] bg-white/70 px-4 py-4 text-sm text-[#4F564F] shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur'
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className='lg:pl-4'>
              <div className='overflow-hidden rounded-[32px] border border-[#DDD6CA] bg-white/70 shadow-[0_18px_50px_rgba(0,0,0,0.09)] backdrop-blur-xl'>
                <div className='relative h-full min-h-[540px]'>
                  <img
                    src='https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80'
                    alt='Elegant hotel suite interior'
                    className='absolute inset-0 h-full w-full object-cover'
                  />
                  <div className='absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.20),rgba(26,29,26,0.12)_28%,rgba(26,29,26,0.62)_100%)]' />
                  <div className='relative flex h-full min-h-[540px] flex-col justify-between p-6'>
                    <div className='flex items-center justify-between rounded-full border border-white/50 bg-white/55 px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#667066] backdrop-blur'>
                      <div className='flex items-center gap-3'>
                        <img src='/emblem.png' alt='ambience emblem' className='h-7 w-7 rounded-full object-cover' />
                        <span>Private Travel Design</span>
                      </div>
                      <span>By ambience</span>
                    </div>

                    <div className='grid gap-4'>
                      <div className='ml-auto max-w-[290px] rounded-[28px] border border-white/55 bg-white/72 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur'>
                        <p className='text-xs uppercase tracking-[0.22em] text-[#8A9A8A]'>Signature Feeling</p>
                        <p className='mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>Calm. Beautiful. Seamless.</p>
                        <p className='mt-3 text-sm leading-6 text-[#5E655E]'>
                          Exceptional rooms, thoughtful rhythm, and experiences that feel personal from the outset.
                        </p>
                      </div>

                      <div className='grid gap-4 sm:grid-cols-2'>
                        <div className='rounded-[28px] border border-white/35 bg-[#1A1D1A]/85 p-5 text-[#FAF8F6] shadow-[0_16px_42px_rgba(0,0,0,0.18)] backdrop-blur'>
                          <div className='flex items-center gap-3'>
                            <img src='/emblem.png' alt='ambience emblem' className='h-8 w-8 rounded-full object-cover' />
                            <p className='text-xs uppercase tracking-[0.22em] text-[#E8C547]'>Approach</p>
                          </div>
                          <p className='mt-3 text-xl font-semibold tracking-[-0.03em]'>Discreet and deeply tailored</p>
                          <p className='mt-3 text-sm leading-6 text-white/72'>
                            Recommendations chosen for beauty, service, and how the full experience will feel.
                          </p>
                        </div>

                        <div className='rounded-[28px] border border-white/55 bg-white/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.07)] backdrop-blur'>
                          <p className='text-xs uppercase tracking-[0.22em] text-[#8A9A8A]'>Experience Layer</p>
                          <p className='mt-3 text-xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>Travel with heart</p>
                          <p className='mt-3 text-sm leading-6 text-[#5C645C]'>
                            A more human approach to luxury, wellness, romance, and memory-making.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className='flex items-center justify-between rounded-[24px] border border-white/45 bg-white/60 px-5 py-4 text-sm text-[#505750] backdrop-blur'>
                      <span>For beautifully considered journeys</span>
                      <span className='font-medium text-[#1A1D1A]'>ambience.travel</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
          <div className='max-w-3xl'>
            <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>A world shaped with care</p>
            <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1A1D1A] sm:text-5xl'>
              Exceptional stays, seamless movement, memorable tables, and restorative moments.
            </h2>
            <p className='mt-5 text-lg leading-8 text-[#5B615B]'>
              The page should feel like more than a service overview. It should feel like an invitation into a quieter, more
              beautiful standard of travel.
            </p>
          </div>

          <div className='mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4'>
            {editorialGallery.map((item) => (
              <div
                key={item.title}
                className='overflow-hidden rounded-[28px] border border-[#D8D2C8] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.05)]'
              >
                <div className='relative h-64 overflow-hidden'>
                  <img src={item.image} alt={item.title} className='h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]' />
                </div>
                <div className='p-6'>
                  <h3 className='text-xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>{item.title}</h3>
                  <p className='mt-3 text-sm leading-6 text-[#606760]'>{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className='border-y border-[#D8D2C8] bg-[#F7F2EC]'>
          <div className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
            <div className='max-w-3xl'>
              <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>Why ambience.travel</p>
              <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1A1D1A] sm:text-5xl'>
                Not just where you go — how it all feels.
              </h2>
              <p className='mt-5 text-lg leading-8 text-[#5B615B]'>
                ambience.travel is for those who want more than reservations. It is for people who value beauty, ease,
                emotional intelligence, and a more personal standard of care.
              </p>
            </div>

            <div className='mt-12 grid gap-6 lg:grid-cols-3'>
              {pillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className='rounded-[28px] border border-[#D8D2C8] bg-white p-7 shadow-[0_12px_32px_rgba(0,0,0,0.05)]'
                >
                  <p className='text-xs uppercase tracking-[0.24em] text-[#8A9A8A]'>Core Pillar</p>
                  <h3 className='mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>{pillar.title}</h3>
                  <p className='mt-4 text-base leading-7 text-[#5C625C]'>{pillar.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
          <div className='grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start'>
            <div>
              <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>The journey is felt in the details</p>
              <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1A1D1A] sm:text-5xl'>
                Beautiful travel starts long before you arrive.
              </h2>
              <p className='mt-5 max-w-xl text-lg leading-8 text-[#596059]'>
                The best journeys do not just look good in photos. They feel calm, supported, and beautifully paced from the
                very beginning.
              </p>
            </div>

            <div className='grid gap-5 sm:grid-cols-2'>
              {journeyMoments.map((item) => (
                <div
                  key={item.title}
                  className='rounded-[28px] border border-[#D8D2C8] bg-white p-6 shadow-[0_10px_28px_rgba(0,0,0,0.05)]'
                >
                  <p className='text-xs uppercase tracking-[0.22em] text-[#8A9A8A]'>Journey Moment</p>
                  <h3 className='mt-4 text-xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>{item.title}</h3>
                  <p className='mt-3 text-sm leading-6 text-[#606760]'>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='border-y border-[#D8D2C8] bg-[#F3EEE8]'>
          <div className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
            <div className='max-w-3xl'>
              <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>Featured experience types</p>
              <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1A1D1A] sm:text-5xl'>
                Designed to feel as good as they look.
              </h2>
              <p className='mt-5 max-w-2xl text-lg leading-8 text-[#596059]'>
                Romantic escapes, restorative retreats, signature city stays, and milestone journeys — all shaped with a calmer,
                more personal touch.
              </p>
            </div>

            <div className='mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3'>
              {experienceTypes.map((item) => (
                <div
                  key={item.title}
                  className='overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-[0_10px_28px_rgba(0,0,0,0.05)] backdrop-blur'
                >
                  <div className='relative h-56 overflow-hidden'>
                    <img src={item.image} alt={item.title} className='h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]' />
                  </div>
                  <div className='p-6'>
                    <h3 className='text-xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>{item.title}</h3>
                    <p className='mt-3 text-sm leading-6 text-[#606760]'>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
          <div className='max-w-3xl'>
            <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>Chosen with discernment. Designed around you.</p>
            <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1A1D1A] sm:text-5xl'>
              A quieter kind of luxury — one rooted in taste, access, and how the experience lands.
            </h2>
            <p className='mt-5 text-lg leading-8 text-[#5B615B]'>
              From world-class suites and private villas to beautifully run hotels, discreet transfers, and memorable dining,
              each recommendation is selected for more than reputation alone. It has to feel right.
            </p>
          </div>

          <div className='mt-12 grid gap-6 lg:grid-cols-3'>
            {hospitalityMoments.map((item) => (
              <div
                key={item.title}
                className='overflow-hidden rounded-[30px] border border-[#D8D2C8] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.05)]'
              >
                <div className='relative h-72 overflow-hidden'>
                  <img src={item.image} alt={item.title} className='h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]' />
                </div>
                <div className='p-7'>
                  <h3 className='text-2xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>{item.title}</h3>
                  <p className='mt-4 text-base leading-7 text-[#5C625C]'>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
          <div className='rounded-[36px] border border-[#D8D2C8] bg-[#1A1D1A] px-8 py-10 text-[#FAF8F6] shadow-[0_20px_60px_rgba(0,0,0,0.22)] lg:px-12 lg:py-14'>
            <div className='grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end'>
              <div>
                <div className='mb-4 flex items-center gap-3'>
                  <img src='/emblem.png' alt='ambience emblem' className='h-9 w-9 rounded-full object-cover' />
                  <p className='text-xs uppercase tracking-[0.28em] text-[#E8C547]'>Begin with ambience.travel</p>
                </div>

                <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#FAF8F6] sm:text-5xl'>
                  Beautifully considered travel, shaped around you.
                </h2>

                <p className='mt-5 max-w-2xl text-lg leading-8 text-white/72'>
                  From discreet concierge support to deeply tailored itineraries and wellness-minded escapes, ambience.travel is
                  designed for those who value beauty, ease, and a more thoughtful standard of service.
                </p>

                <div className='mt-8 flex flex-wrap gap-4'>
                  <button
                    disabled
                    aria-disabled='true'
                    className='cursor-not-allowed rounded-full bg-[#B7A978] px-6 py-3 text-sm font-semibold text-[#1A1D1A] opacity-80'
                  >
                    Request Travel Planning
                  </button>

                  <button
                    disabled
                    aria-disabled='true'
                    className='cursor-not-allowed rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 opacity-80'
                  >
                    Explore Wellnesscapes
                  </button>
                </div>
              </div>

              <div className='grid gap-4'>
                <div className='rounded-[28px] border border-white/12 bg-white/5 p-6 backdrop-blur'>
                  <p className='text-xs uppercase tracking-[0.22em] text-white/50'>What guests can expect</p>
                  <ul className='mt-4 space-y-3 text-sm leading-6 text-white/78'>
                    <li>• Highly tailored itinerary design with personal taste in mind</li>
                    <li>• Calm, discreet support before and during travel</li>
                    <li>• A more meaningful, human approach to premium travel</li>
                  </ul>
                </div>

                <div className='rounded-[28px] border border-white/12 bg-white/5 p-6 backdrop-blur'>
                  <p className='text-xs uppercase tracking-[0.22em] text-white/50'>Public-facing brand tone</p>
                  <p className='mt-4 text-sm leading-6 text-white/78'>
                    Premium without being cold. Beautiful without feeling performative. Service-led, emotionally intelligent, and
                    designed around the person behind the journey.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
