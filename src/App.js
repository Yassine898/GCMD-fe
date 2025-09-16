import { BrowserRouter, Route, Routes } from 'react-router';
import './App.css';
import SignInForm from './components/signIn.jsx';
import api from './config/api.jsx';
import { useEffect } from 'react'; // Keep this useEffect for initial CSRF token
import Dashboard from './components/Dashboard.jsx';
import MemberDetails from './components/MemberDetails.jsx';

function App() {
  useEffect(() => {
   // This fetches the initial CSRF cookie when the application loads.
   // This is the correct place for a general CSRF cookie request for the entire SPA session.
   api.get('sanctum/csrf-cookie');
}, []);
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path='/' >
    <Route path='login' index element={<SignInForm/>} />
    </Route>
          <Route path='/dashboard' element={<Dashboard/>}/>
          <Route path='/member-details/:id' element={<MemberDetails/>}/>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
