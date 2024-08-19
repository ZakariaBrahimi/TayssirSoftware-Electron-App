/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { Button } from "@shadcn-components/ui/button";
import { Input } from "@shadcn-components/ui/input";
import { Label } from "@shadcn-components/ui/label";
import { useState } from "react";
import { useNavigate } from 'react-router-dom';

const fs = window.api.fs;
const path = window.api.path;
const os = window.api.os;
const crypto = window.api.createHmac

const LicenseKeyInputPage = ({ setAuthState }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Function to get Local Machine MAC Address
  const getMacAddress = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
      for (const net of networkInterfaces[interfaceName]) {
        if (net.mac && net.mac !== '00:00:00:00:00:00') {
          return net.mac;
        }
      }
    }
    return null; // No MAC address found
  };

  // Function to generate a unique identifier from a MAC address
  const generateLicenseKey = (macAddress) => {
    return crypto.createHash('sha256').update(macAddress).digest('hex');
  };

  // Function to check if license key is valid
  const validateLicenseKey = (enteredKey) => {
    const uniqueId = getMacAddress();
    if (uniqueId) {
      const expectedKey = generateLicenseKey(uniqueId);
      return enteredKey === expectedKey;
    } else {
      setError('No MAC address found.');
      return false;
    }
  };

  const handleSubmit = () => {
    setIsLoading(true);
    const licensePath = path.join(os.homedir(), 'app_license.key');

    try {
      const isValid = validateLicenseKey(licenseKey);
      if (isValid) {
        fs.writeFileSync(licensePath, licenseKey);
        setAuthState((prevState) => ({ ...prevState, hasLicenseKey: true }));
        navigate('/signup'); // Redirect to the signup page
      } else {
        setError('License key is not valid. Please try another one.');
      }
    } catch (err) {
      console.error("Failed to store the license key:", err);
      setError("Failed to store the license key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto lg:grid lg:min-h-[600px] lg:grid-cols-1 xl:min-h-[800px]">
      <div className="flex items-center justify-center pb-12">
        <div className="mx-auto grid w-[650px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Licensing Key</h1>
            <p className="text-muted-foreground">
              Enter a valid license key below for verification
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
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
              />
            </div>
            
            {error && <p className="text-red-500">{error}</p>}

            <Button onClick={handleSubmit} type="button" className="w-full" disabled={isLoading}>
              {isLoading ? "Validating..." : "Validate"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseKeyInputPage;
