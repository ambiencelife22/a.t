'use client'
import React, { Fragment } from 'react'
import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Wellnesscapes', href: 'https://www.ambience.life/wellnesscapes', target: '_blank'  },
//   { name: 'Features', href: '#' },
//   { name: 'Marketplace', href: '#' },
//   { name: 'Company', href: '#' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className='bg-[#F1F1F1]'>
      <nav className='mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8' aria-label='Global'>
        
        <a href='/' className='-m-1.5 p-1.5 noto text-4xl'>
            a.t
        </a>
        <div className='flex lg:hidden'>
          <button
            type='button'
            className='-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700'
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className='sr-only'>Open main menu</span>
            <Bars3Icon className='h-6 w-6' aria-hidden='true' />
          </button>
        </div>
        <div className='hidden lg:flex lg:gap-x-12'>
          {navigation.map((item) => (
           <React.Fragment key={item.name}>
                <a
                    href={item.href}
                    target={item.target ? '_blank' : undefined}
                    rel={item.target ? 'noopener noreferrer' : undefined}
                    className='text-sm font-semibold leading-6 text-gray-900 hover:underline'
                >
                    {item.name}
                    {item.target && (
                        <span aria-hidden='true' className='pl-2'>&rarr;</span>
                    )}
                </a>
            </React.Fragment>
          ))}
        </div>
      </nav>
      <Dialog as='div' className='lg:hidden' open={mobileMenuOpen} onClose={setMobileMenuOpen}>
        <div className='fixed inset-0 z-10' />
        <Dialog.Panel className='fixed inset-y-0 right-0 z-10 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10'>
          <div className='flex items-center justify-between'>
            <a href='/' className='-m-1.5 p-1.5 noto text-4xl'>
              a.t
            </a>
            <button
              type='button'
              className='-m-2.5 rounded-md p-2.5 text-gray-700'
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className='sr-only'>Close menu</span>
              <XMarkIcon className='h-6 w-6' aria-hidden='true' />
            </button>
          </div>
          <div className='mt-6 flow-root'>
            <div className='-my-6 divide-y divide-gray-500/10'>
              <div className='space-y-2 py-6'>
                {navigation.map((item) => (
                   <React.Fragment key={item.name}>
                   <a
                       href={item.href}
                       target={item.target ? '_blank' : undefined}
                       rel={item.target ? 'noopener noreferrer' : undefined}
                       className='text-sm font-semibold leading-6 text-gray-900 hover:underline'
                   >
                       {item.name}
                       {item.target && (
                           <span aria-hidden='true' className='pl-2'>&rarr;</span>
                       )}
                   </a>
               </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </Dialog>
    </header>
  )
}
