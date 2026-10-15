/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@shadcn-components/ui/button';
import { Input } from '@shadcn-components/ui/input';
import { Label } from '@shadcn-components/ui/label';

const Signup = ({ authState, setAuthState }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = () => {
    setIsLoading(true);
    setError(null);

    window.electron.ipcRenderer.send('signup', { username, password });

    window.electron.ipcRenderer.once('signup:response', (event, response) => {
      setIsLoading(false);
      
      if (response.success) {
        console.log('User signed up successfully', response.user);

        
        // Navigate to login or dashboard
        navigate('/login');
      } else {
        console.error('Signup error', response.message);
        setError(response.message);
      }
    });
  };

  return (
    <div className="w-full mx-auto lg:grid lg:min-h-[600px] lg:grid-cols-1 xl:min-h-[800px]">
      <div className="flex items-center justify-center pb-12">
        <div className="mx-auto grid w-[650px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Signup</h1>
            <p className="text-balance text-muted-foreground">
              Enter your username and password below to create a new account.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="barakaStore"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500">{error}</p>}
            <Button onClick={handleSignup} type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
