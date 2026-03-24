'use client'
import React from 'react'

import Example from './home/Home'
import Header from './home/Header'

import './app.css'

const SquareExamplePage = () => {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F1F1F1' }}>
        <link rel='icon' href='/favicon.ico' sizes='any' />
        
        <Example />
      </div>
    )
  }
  
  export default SquareExamplePage