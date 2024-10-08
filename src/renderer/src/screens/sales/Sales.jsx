/* eslint-disable prettier/prettier */

import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@shadcn-components/ui/popover'
import { Button } from '@shadcn-components/ui/button'
import { Calendar } from '@shadcn-components/ui/calendar'
import { format } from 'date-fns'
import { useContext, useEffect, useState } from 'react'
import DataTable from './dataGrid/DataTable'
import NewProductSell from './NewProductSell'
import SalesContext from '../../context/SalesContext'
// import { DateRange } from "react-day-picker"

const Sales = () => {
  // const [fromDate, setFromDate] = useState()
  // const [open, setOpen] = useState(false)
  const { getSoldProducts, getSoldProductsAtDateTime } = useContext(SalesContext)
  const [date, setDate] = useState({
    from: null,
    to: null
  })
  useEffect(()=>{
    
    getSoldProductsAtDateTime(date)
  }, [date])
  useEffect(()=>{
    getSoldProducts()
  }, [])
  return (
    <div className="flex flex-col w-full lg:ml-[16%]">
      {/* <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6"> */}
        {/* <button
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9 shrink-0 md:hidden"
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="radix-:R2quuuuu6la:"
          data-state="closed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-menu h-5 w-5"
          >
            <line x1="4" x2="20" y1="12" y2="12"></line>
            <line x1="4" x2="20" y1="6" y2="6"></line>
            <line x1="4" x2="20" y1="18" y2="18"></line>
          </svg>
          <span className="sr-only">Toggle navigation menu</span>
        </button>
        <div className="w-full flex-1">
          <form>
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-search absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <input
                type="search"
                className="flex h-9 rounded-md border border-input px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                placeholder="Search products..."
              />
            </div>
          </form>
        </div>
        <button
          className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 w-9 rounded-full"
          type="button"
          id="radix-:R6quuuuu6la:"
          aria-haspopup="menu"
          aria-expanded="false"
          data-state="closed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-circle-user h-5 w-5"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="10" r="3"></circle>
            <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path>
          </svg>
          <span className="sr-only">Toggle user menu</span>
        </button> */}
      {/* </header> */}
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 ">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold md:text-2xl">Sales</h1>
          <div className='flex gap-6 items-center'>

            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className={cn(
                    'w-[300px] justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(date.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
            <NewProductSell/>
          </div>
        </div>
        <DataTable />
      </main>
    </div>
  )
}

export default Sales
