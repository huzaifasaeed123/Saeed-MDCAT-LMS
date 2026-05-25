import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../../core/auth/useAuth';
import { FiZap, FiVideo, FiBarChart2, FiUsers, FiArrowRight, FiAward } from 'react-icons/fi';

// SKN-branded public landing.
// Hero is full-bleed gradient stage with logo lockup, headline, two CTAs.
// Below: four feature tiles with brand-gradient icon chips.
const Feature = ({ Icon, title, blurb }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
    <div className="w-11 h-11 rounded-xl bg-brand-gradient-soft flex items-center justify-center mb-4">
      <Icon className="w-5 h-5 text-primary-700" />
    </div>
    <h3 className="text-lg font-bold text-gray-900 mb-1.5">{title}</h3>
    <p className="text-sm text-gray-500 leading-relaxed">{blurb}</p>
  </div>
);

const HomePage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-gradient text-white">
        {/* Decorative orbs (CSS only) */}
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-32 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(252,211,77,.35), transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
          {/* Logo lockup */}
          <div className="flex items-center gap-3 mb-12">
            <img src="/skn-logo-mark.png" alt="" className="w-12 h-12 rounded-xl bg-white/15 border border-white/40 p-1 object-contain" />
            <div>
              <div className="font-extrabold text-xl tracking-tight leading-none">SKN Academy</div>
              <div className="text-[10px] font-semibold tracking-[0.18em] opacity-85 mt-1">LEARNING MANAGEMENT SYSTEM</div>
            </div>
          </div>

          <div className="font-mono text-xs tracking-[0.18em] uppercase opacity-85 mb-3">MDCAT · 2025 Cycle</div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] leading-[1.05] max-w-3xl">
            Crack MDCAT with the<br />
            <i className="font-bold italic">sharpest</i> practice in PK.
          </h1>
          <p className="text-base sm:text-lg opacity-90 mt-5 max-w-2xl leading-relaxed">
            18,000+ vetted MCQs · Chapter-wise mocks · Live leaderboards · Doctor-mentor community.
            Built by a panel of MBBS toppers.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            {isAuthenticated ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-primary-700 font-bold text-sm shadow-lg hover:shadow-xl transition-all">
                Go to Dashboard <FiArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                {/* ── "Start free" signup CTA disabled ────────────────────
                    Public signup is currently off site-wide. Restore the
                    block below to bring the "Start free" → /register
                    button back on the landing hero. */}
                {/*
                <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-primary-700 font-bold text-sm shadow-lg hover:shadow-xl transition-all">
                  Start free <FiArrowRight className="w-4 h-4" />
                </Link>
                */}
                <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-primary-700 font-bold text-sm shadow-lg hover:shadow-xl transition-all">
                  Sign in <FiArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-10 text-sm opacity-90">
            <div className="flex items-center gap-2"><FiAward className="w-4 h-4" /> 2,300+ students enrolled</div>
            <div>·</div>
            <div>92% top-10 hit rate</div>
            <div>·</div>
            <div>Free 7-day trial</div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400 mb-2">Why SKN Academy</div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-[-0.025em] mb-10">
          Everything you need to <span className="text-brand-gradient">peak</span> on test day.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Feature Icon={FiZap}       title="Practice MCQs"     blurb="Thousands of curated questions across Biology, Chemistry, Physics and English." />
          <Feature Icon={FiVideo}     title="Video Lectures"    blurb="Concept-first videos by Saeed Sir and a panel of MBBS toppers." />
          <Feature Icon={FiBarChart2} title="Smart Analytics"   blurb="Per-chapter weak-spot detection, accuracy trends, and study time." />
          <Feature Icon={FiUsers}     title="Community Support" blurb="Ask questions, earn points on the leaderboard, study with peers." />
        </div>

        <div className="text-center mt-14 text-xs text-gray-400 font-medium">
          &copy; {new Date().getFullYear()} <span className="text-brand-gradient font-bold">SKN Academy</span> · All rights reserved.
        </div>
      </section>
    </div>
  );
};

export default HomePage;
