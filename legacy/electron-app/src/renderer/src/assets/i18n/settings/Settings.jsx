/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shadcn-components/ui/tabs'
import PrintingSettings from './PrintingSettings'

const Settings = () => {
  return (
    <div className='flex flex-col w-full lg:ml-[16%]'>
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">

      <Tabs defaultValue="account" className="w-[400px]">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="Printing">Printing</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Make changes to your account here.</TabsContent>
        <TabsContent value="Printing">
          <PrintingSettings/>
        </TabsContent>
      </Tabs>
      </main>
    </div>
  )
}

export default Settings
