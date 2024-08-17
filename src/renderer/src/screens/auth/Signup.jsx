/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@shadcn-components/ui/button'
import { Input } from '@shadcn-components/ui/input'
import { Label } from '@shadcn-components/ui/label'
const Signup = ({ authState, setAuthState }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const handleSignup = () => {
    window.electron.ipcRenderer.send('signup', { username, password })
    window.electron.ipcRenderer.once('signup:response', (event, response) => {
      if (response.success) {
        // change the status isLoggedIn to true
        // setAuthState((prevState) => ({
        //   ...prevState,
        //   isLoggedIn: true
        // }))
        console.log('User signup in successfully', response.user)
        // window.location.reload()
        navigate('login')
      } else {
        console.error('signup error', response.message)
      }
    })
  }

  return (
    <div className="w-full mx-auto  lg:grid lg:min-h-[600px] lg:grid-cols-1 xl:min-h-[800px]">
      <div className="flex items-center justify-center pb-12 ">
        <div className="mx-auto grid w-[650px] gap-6 ">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Signup</h1>
            <p className="text-balance text-muted-foreground">
              Enter your username and password below to create a new account.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">username</Label>
              <Input
                id="username"
                type="username"
                placeholder="barakaStore"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                {/* <Link
                  href="/forgot-password"
                  className="ml-auto inline-block text-sm underline"
                >
                  Forgot your password?
                </Link> */}
              </div>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                id="password"
                type="password"
                required
              />
            </div>
            <Button onClick={handleSignup} type="submit" className="w-full">
              Register
            </Button>
            {/* <Button variant="outline" className="w-full">
              Login with Google
            </Button> */}
          </div>
          {/* <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="#" className="underline">
              Sign up
            </Link>
          </div> */}
        </div>
      </div>
      {/* <div className="hidden bg-muted lg:block">
        <img
          src="/placeholder.svg"
          alt="Image"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div> */}
    </div>
  )
}

export default Signup
