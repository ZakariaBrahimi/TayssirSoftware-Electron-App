/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@shadcn-components/ui/button';
import { Input } from '@shadcn-components/ui/input';
import { Label } from '@shadcn-components/ui/label';

const Login = ({ authState, setAuthState }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    setIsLoading(true);
    setError(null);

    window.electron.ipcRenderer.send('login', { username, password });

    window.electron.ipcRenderer.once('login:response', (event, response) => {
      setIsLoading(false);
      
      if (response.success) {
        console.log(response.user)
        setAuthState((prevState) => ({
          ...prevState,
          isLoggedIn: true,
          user: response.user.dataValues,
        }));
        
        setTimeout(() => {
          navigate('/dashboard'); // Ensure this path is correct for your main content
        }, 0);

        console.log('User logged in successfully', response.user);
      } else {
        setError(response.message);
        console.error('Login error', response.message);
      }
    });
  };

  return (
    <div className="w-full mx-auto lg:grid lg:min-h-[600px] lg:grid-cols-1 xl:min-h-[800px]">
      <div className="flex items-center justify-center pb-12">
        <div className="mx-auto grid w-[650px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Login</h1>
            <p className="text-balance text-muted-foreground">
              Enter your username and password below to login to your account
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="barakaStore05"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="ml-auto inline-block text-sm underline">
                  Forgot your password?
                </Link>
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
            <Button onClick={handleLogin} type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
