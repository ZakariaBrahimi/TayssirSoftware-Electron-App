/* eslint-disable prettier/prettier */
import { Button } from "@shadcn-components/ui/button"
import { Input } from "@shadcn-components/ui/input"
import { Label } from "@shadcn-components/ui/label"
import { useState } from "react";
import { useNavigate } from 'react-router-dom';

const fs = window.api.fs;
const path = window.api.path;
const os = window.api.os;
/* eslint-disable no-undef */
const LicenseKeyInputPage = ()=> {
    const [licenseKey, setLicenseKey] = useState('');
    const navigate = useNavigate();
    
    const handleSubmit = () => {
      const licensePath = path.join(os.homedir(), 'app_license.key');
      
      // Store the license key in the file
      fs.writeFileSync(licensePath, licenseKey);
      
      // After storing, reload the app to show the login page
      // navigate('/signup');
      window.location.reload();
    };
  
    return (
      <div className="w-full mx-auto  lg:grid lg:min-h-[600px] lg:grid-cols-1 xl:min-h-[800px]">
      <div className="flex items-center justify-center pb-12 ">
        <div className="mx-auto grid w-[650px] gap-6 ">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Licensing Key</h1>
            <p className="text-balance text-muted-foreground">
              Enter your a valid license key below to verification
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="key">License Key</Label>
              <Input
                id="key"
                type="text"
                placeholder="Enter a License Key"
                required
                value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)}
              />
            </div>
            
            <Button onClick={handleSubmit} type="submit" className="w-full">
              Validate
            </Button>
            
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
    );
  }
  export default LicenseKeyInputPage