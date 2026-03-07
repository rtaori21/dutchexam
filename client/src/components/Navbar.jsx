import React from 'react';
import { NavLink } from 'react-router-dom';
import { Book, Zap, LayoutDashboard, Mic, HelpCircle } from 'lucide-react';

export default function Navbar() {
    const linkClass = ({ isActive }) =>
        `btn ${isActive ? 'btn-primary' : 'btn-outline'}`;

    return (
        <nav style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            padding: '20px 0',
            background: 'transparent',
            backdropFilter: 'blur(10px)'
        }}>
            <div className="container" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: 'linear-gradient(to right, #6366f1, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        DutchMaster
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                    <NavLink to="/" className={linkClass}>
                        <LayoutDashboard size={18} />
                        Dashboard
                    </NavLink>
                    <NavLink to="/speaking" className={linkClass}>
                        <Mic size={18} />
                        Speaking
                    </NavLink>
                    <NavLink to="/speaking/qa" className={linkClass}>
                        <HelpCircle size={18} />
                        Q&A
                    </NavLink>
                    <NavLink to="/dictionary" className={linkClass}>
                        <Book size={18} />
                        Dictionary
                    </NavLink>
                    <NavLink to="/practice" className={linkClass}>
                        <Zap size={18} />
                        Practice
                    </NavLink>
                </div>
            </div>
        </nav>
    );
}
