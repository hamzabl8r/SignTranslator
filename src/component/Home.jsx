import React from 'react'
import Header from './Header'
import './Styles/Home.css'

const Home = () => {
  return (
    <>
    <div className='nav'>
      
    </div>
    <div className='home'>
        <h1>Welcome to the Translator App</h1>
        <p>Translate text between multiple languages with ease.</p>
        <p>View your translation history and manage your profile.</p>
        <p>Get started by navigating to the Translator page.</p>
        <button className='get-started-btn' onClick={() => window.location.href='/login'}>Get Started</button>
    </div>

    </>
    
  )
}

export default Home
