export default function App() {
  const pillars = [
    {
      title: 'Travel Design',
      text: 'Thoughtfully designed journeys shaped around who you are, how you want to feel, and what will make the experience memorable.',
    },
    {
      title: 'Lifestyle Management',
      text: 'Support that extends beyond reservations, with a more personal, intuitive layer of planning and coordination.',
    },
    {
      title: 'Private Concierge',
      text: 'Discreet, elevated assistance for those who value trust, detail, and a highly tailored level of care.',
    },
  ]

  const highlights = [
    'Personally guided, not mass-market',
    'Calm premium aesthetic with emotional warmth',
    'Built around connection, discretion, and care',
    'Designed for meaningful experiences, not just logistics',
  ]

  const experiences = [
    {
      title: 'Curated Journeys',
      text: 'From restorative escapes to milestone celebrations, every itinerary is built to feel intentional, seamless, and deeply personal.',
    },
    {
      title: 'Wellnesscapes',
      text: 'Immersive wellness-minded experiences that blend rejuvenation, beauty, and a stronger connection to place.',
    },
    {
      title: 'Trusted Support',
      text: 'A relationship-driven approach rooted in responsiveness, discretion, and the desire to genuinely serve.',
    },
  ]

  return (
    <main className='min-h-screen bg-[#FAF8F6] text-[#1A1D1A]'>
      <section className='relative overflow-hidden border-b border-[#D8D2C8] bg-[radial-gradient(circle_at_top_left,rgba(232,197,71,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(90,106,90,0.12),transparent_24%),linear-gradient(to_bottom,#faf8f6,#f4efe8)]'>
        <div className='absolute inset-0 opacity-40'>
          <div className='absolute left-[8%] top-20 h-40 w-40 rounded-full bg-[#E8C547]/25 blur-3xl' />
          <div className='absolute right-[8%] top-24 h-48 w-48 rounded-full bg-[#5A6A5A]/15 blur-3xl' />
        </div>

        <div className='relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-28'>
          <div className='max-w-3xl'>
            <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>
              ambience.travel
            </p>

            <h1 className='mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-[#1A1D1A] sm:text-6xl lg:text-7xl'>
              Meaningful travel,
              <span className='block text-[#5A6A5A]'>
                thoughtfully designed.
              </span>
            </h1>

            <p className='mt-6 max-w-2xl text-lg leading-8 text-[#555B55] sm:text-xl'>
              A calm, elevated approach to travel design and concierge —
              shaped by personal connection, refined taste, and a genuine
              desire to serve.
            </p>

            <div className='mt-10 flex flex-wrap gap-4'>
              <button
                disabled
                aria-disabled='true'
                className='cursor-not-allowed rounded-full bg-[#A8AAA8] px-6 py-3 text-sm font-semibold text-[#FAF8F6] opacity-70 shadow-none'
              >
                Begin the Conversation
              </button>

              <button
                disabled
                aria-disabled='true'
                className='cursor-not-allowed rounded-full border border-[#D8D2C8] bg-[#F3F1EC] px-6 py-3 text-sm font-semibold text-[#8A8F8A] opacity-80'
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
            <div className='rounded-[32px] border border-[#DDD6CA] bg-white/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.09)] backdrop-blur-xl'>
              <div className='overflow-hidden rounded-[26px] bg-[#EDE6DB]'>
                <div className='relative h-[500px] w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0.02)),linear-gradient(135deg,#d9cfbf_0%,#efe8dd_38%,#d8e1d8_100%)] p-6'>
                  <div className='absolute inset-x-0 top-0 h-28 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.65),transparent)]' />

                  <div className='relative flex h-full flex-col justify-between'>
                    <div className='flex items-center justify-between rounded-full border border-white/60 bg-white/60 px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#667066] backdrop-blur'>
                      <span>Private Travel Design</span>
                      <span>By ambience</span>
                    </div>

                    <div className='grid gap-4'>
                      <div className='ml-auto max-w-[280px] rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur'>
                        <p className='text-xs uppercase tracking-[0.22em] text-[#8A9A8A]'>
                          Signature Feeling
                        </p>
                        <p className='mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>
                          Calm. Beautiful. Seamless.
                        </p>
                        <p className='mt-3 text-sm leading-6 text-[#5E655E]'>
                          Experiences designed to feel personal, restorative,
                          and quietly unforgettable.
                        </p>
                      </div>

                      <div className='grid gap-4 sm:grid-cols-2'>
                        <div className='rounded-[28px] border border-white/70 bg-[#1A1D1A] p-5 text-[#FAF8F6] shadow-[0_16px_42px_rgba(0,0,0,0.18)]'>
                          <p className='text-xs uppercase tracking-[0.22em] text-[#E8C547]'>
                            Approach
                          </p>
                          <p className='mt-3 text-xl font-semibold tracking-[-0.03em]'>
                            Discreet and deeply tailored
                          </p>
                          <p className='mt-3 text-sm leading-6 text-white/72'>
                            Every recommendation should feel aligned with the
                            person behind the trip.
                          </p>
                        </div>

                        <div className='rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.07)] backdrop-blur'>
                          <p className='text-xs uppercase tracking-[0.22em] text-[#8A9A8A]'>
                            Experience Layer
                          </p>
                          <p className='mt-3 text-xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>
                            Travel with heart
                          </p>
                          <p className='mt-3 text-sm leading-6 text-[#5C645C]'>
                            A more human approach to luxury, wellness, and
                            memory-making.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className='flex items-center justify-between rounded-[24px] border border-white/65 bg-white/65 px-5 py-4 text-sm text-[#505750] backdrop-blur'>
                      <span>For thoughtfully designed journeys</span>
                      <span className='font-medium text-[#1A1D1A]'>
                        ambience.travel
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
        <div className='max-w-3xl'>
          <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>
            What this brand expression stands for
          </p>

          <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1A1D1A] sm:text-5xl'>
            A more personal kind of travel brand.
          </h2>

          <p className='mt-5 text-lg leading-8 text-[#5B615B]'>
            ambience.travel should feel less like a booking service and more
            like a trusted, beautifully presented relationship. The tone is
            refined, warm, and intentionally understated.
          </p>
        </div>

        <div className='mt-12 grid gap-6 lg:grid-cols-3'>
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className='rounded-[28px] border border-[#D8D2C8] bg-white p-7 shadow-[0_12px_32px_rgba(0,0,0,0.05)]'
            >
              <p className='text-xs uppercase tracking-[0.24em] text-[#8A9A8A]'>
                Core Pillar
              </p>
              <h3 className='mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>
                {pillar.title}
              </h3>
              <p className='mt-4 text-base leading-7 text-[#5C625C]'>
                {pillar.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className='border-y border-[#D8D2C8] bg-[#F3EEE8]'>
        <div className='mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-24'>
          <div>
            <p className='text-xs uppercase tracking-[0.28em] text-[#8A9A8A]'>
              Signature Experience Themes
            </p>

            <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1A1D1A] sm:text-5xl'>
              Designed to feel as good as they look.
            </h2>

            <p className='mt-5 max-w-xl text-lg leading-8 text-[#596059]'>
              The visual language should combine editorial elegance,
              atmospheric destinations, and a sense of emotional calm.
            </p>
          </div>

          <div className='grid gap-5 sm:grid-cols-3'>
            {experiences.map((item) => (
              <div
                key={item.title}
                className='rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_10px_28px_rgba(0,0,0,0.05)] backdrop-blur'
              >
                <div className='h-28 rounded-[20px] bg-[linear-gradient(135deg,#d4cab8_0%,#ebe4d8_48%,#d5dfd6_100%)]' />
                <h3 className='mt-5 text-xl font-semibold tracking-[-0.03em] text-[#1A1D1A]'>
                  {item.title}
                </h3>
                <p className='mt-3 text-sm leading-6 text-[#606760]'>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24'>
        <div className='rounded-[36px] border border-[#D8D2C8] bg-[#1A1D1A] px-8 py-10 text-[#FAF8F6] shadow-[0_20px_60px_rgba(0,0,0,0.22)] lg:px-12 lg:py-14'>
          <div className='grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end'>
            <div>
              <p className='text-xs uppercase tracking-[0.28em] text-[#E8C547]'>
                Begin with ambience.travel
              </p>

              <h2 className='mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#FAF8F6] sm:text-5xl'>
                Travel designed with taste, depth, and genuine care.
              </h2>

              <p className='mt-5 max-w-2xl text-lg leading-8 text-white/72'>
                From bespoke itineraries and discreet concierge support to
                thoughtfully curated wellness-minded journeys, ambience.travel
                is designed for those who value both beauty and substance.
              </p>

              <div className='mt-8 flex flex-wrap gap-4'>
                <button
                  disabled
                  aria-disabled='true'
                  className='cursor-not-allowed rounded-full bg-[#B7A978] px-6 py-3 text-sm font-semibold text-[#1A1D1A] opacity-70'
                >
                  Request Travel Planning
                </button>

                <button
                  disabled
                  aria-disabled='true'
                  className='cursor-not-allowed rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/55 opacity-70'
                >
                  Explore Wellnesscapes
                </button>
              </div>
            </div>

            <div className='grid gap-4'>
              <div className='rounded-[28px] border border-white/12 bg-white/5 p-6 backdrop-blur'>
                <p className='text-xs uppercase tracking-[0.22em] text-white/50'>
                  What guests can expect
                </p>
                <ul className='mt-4 space-y-3 text-sm leading-6 text-white/78'>
                  <li>
                    • Highly tailored itinerary design with personal taste in
                    mind
                  </li>
                  <li>• Calm, discreet support before and during travel</li>
                  <li>
                    • A more meaningful, human approach to premium travel
                  </li>
                </ul>
              </div>

              <div className='rounded-[28px] border border-white/12 bg-white/5 p-6 backdrop-blur'>
                <p className='text-xs uppercase tracking-[0.22em] text-white/50'>
                  Public-facing brand tone
                </p>
                <p className='mt-4 text-sm leading-6 text-white/78'>
                  Premium without being cold. Beautiful without feeling
                  performative. Service-led, emotionally intelligent, and
                  designed around the person behind the journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}