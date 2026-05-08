import React from 'react';
import { Link } from 'react-router-dom';
import './Styles/Home.css';

const Home = () => {
  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Break the Barrier with <span className="text-gradient">Language</span>
          </h1>
          <p className="hero-subtitle">
            Experience seamless translation and real-time chat powered by advanced AI. 
            Connect with the world in your own language.
          </p>
          <div className="hero-btns">
            <Link to="/login" className="btn-primary">Get Started</Link>
            <Link to="/about" className="btn-secondary">Learn More</Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="abstract-shape"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="feature-card">
          <div className="icon">🌍</div>
          <h3>Instant Translation</h3>
          <p>Translate text between 100+ languages with industry-leading accuracy.</p>
        </div>
        <div className="feature-card">
          <div className="icon">💬</div>
          <h3>Real-time Chat</h3>
          <p>Connect with users globally and chat without language borders.</p>
        </div>
        <div className="feature-card">
          <div className="icon">📜</div>
          <h3>History Tracking</h3>
          <p>Save and revisit your previous translations whenever you need them.</p>
        </div>
      </section>
    </div>
  );
};

export default Home;