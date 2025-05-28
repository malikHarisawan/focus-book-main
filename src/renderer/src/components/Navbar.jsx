// Navbar.js
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className='bg-gray-800 p-6'>
      <Link to="/" style={{ marginRight: '1rem' }}>Home</Link>
      <Link to="/settings" style={{ marginRight: '1rem' }}>Settings</Link>
    </nav>
  );
}

export default Navbar;
