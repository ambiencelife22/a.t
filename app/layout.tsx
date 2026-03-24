import React from 'react'

import Header from './home/Header'

export const metadata = {
  title: 'ambience.travel',
  description: 'Your lifestyle. Your destination.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <head>
        <meta charSet='utf-8' />
        <title>{metadata.title}</title>
        <meta name='description' content={metadata.description} />
      </head>
      <body>
        <Header />
        {children}
      </body>
    </html>
  )
}
