/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from 'react';
import { Link, useNavigate,  } from 'react-router-dom';
import { Button } from '@shadcn-components/ui/button';
import { Input } from '@shadcn-components/ui/input';
import { Label } from '@shadcn-components/ui/label';
import { useTranslation } from "react-i18next";
import i18next from "i18next";
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


  // //add content containing folder to useTranslation hook
  //   //can add multiple folders to this hook
  //   const { i18n, t } = useTranslation(["Login"]);

  //   //default translation will be in English if some error happens 
  //   //when the page load
  //   useEffect(() => {
  //     // console.log(i18n)
  //     // console.log(t)
  //     console.log(t("login"))
  //     if (localStorage.getItem("i18nextLng")?.length > 2) {
  //         i18next.changeLanguage("en");
  //     }
  // }, []);
  // const handleLanguageChange = (e) => {
  //     i18n.changeLanguage(e.target.value);
  // };

  const { i18n, t } = useTranslation(["Login"]); // Ensure the correct namespace

useEffect(() => {
    console.log("Loaded namespaces:", i18n.options.ns);
    console.log("Current Language:", i18n.language);
    console.log("Translation test:", t("Username"));
  if (localStorage.getItem("i18nextLng")?.length > 2) {
    i18next.changeLanguage("en");
  }
}, []);


const handleLanguageChange = (e) => {
  const newLang = e.target.value;
  i18n.changeLanguage(newLang);
  localStorage.setItem("i18nextLng", newLang); // Save the selected language
};

  return (
    <div className="w-full mx-auto lg:grid lg:min-h-[600px] lg:grid-cols-1 xl:min-h-[800px]">
      <div className="flex items-center justify-center pb-12">
        <div className="mx-auto grid w-[650px] gap-6">
          <div className="grid gap-2 text-center">
          <select
                value={localStorage.getItem("i18nextLng")}
                onChange={handleLanguageChange}
            >
                {/* //make sure to use the same json file name as the values */}
                <option value="en">English</option>
                <option value="ar">Arabic</option>
            </select>
            {/* //can display content using useTranslation hook by calling 
            //key values in json files */}
            
            <h1 className="text-3xl font-bold"> {t("login")}</h1>
            <p className="text-balance text-muted-foreground">
            {/* {t("Enter your username and password below to login to your account")} */}
              
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
              {/* <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="ml-auto inline-block text-sm underline">
                  Forgot your password?
                </Link>
              </div> */}
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
          {/* <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="underline">
              Sign up
            </Link>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Login;
