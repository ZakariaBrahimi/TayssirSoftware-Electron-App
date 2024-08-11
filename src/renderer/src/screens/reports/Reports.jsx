/* eslint-disable prettier/prettier */
/* eslint-disable prettier/prettier */
import { Activity, CircleUser, CreditCard, DollarSign, Users } from 'lucide-react'

import { Button } from '@shadcn-components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@shadcn-components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shadcn-components/ui/dropdown-menu'

import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContext, useEffect, useState } from 'react'
import SalesContext from '../../context/SalesContext'
import ProductContext from '../../context/ProductContext'

import { Popover, PopoverContent, PopoverTrigger } from '@shadcn-components/ui/popover'
import { Calendar } from '@shadcn-components/ui/calendar'
import { format } from 'date-fns'
import LineChart from './LineChart.jsx'


const Reports = () => {
  const { soldProducts } = useContext(SalesContext)
  const { products } = useContext(ProductContext)
  // Net Profit for the current Month: starting from 01/../.... to 30/../....
  const [totalNetProfit, setTotalNetProfit] = useState(0)
  const total_net_profit = () => {
    let total_profit = 0
    soldProducts.forEach((soldProduct) => {
      const price = soldProduct.product.price
      const cost = soldProduct.product.cost
      const discount = soldProduct.discount
      const quantity = soldProduct.quantity
      const netProfitPerProduct = (price - cost - discount) * quantity
      total_profit += netProfitPerProduct
    })

    setTotalNetProfit(total_profit) // Setting total revenue once after the loop
  }
  // Total Rev for the current Month: starting from 01/../.... to 30/../....
  const [totalRevenue, setTotalRevenue] = useState(0)
  const total_revenue = () => {
    let result = 0
    soldProducts.forEach((soldProduct) => {
      const price = soldProduct.product.price
      const discount = soldProduct.discount
      const quantity = soldProduct.quantity
      result += (price - discount) * quantity
    })

    setTotalRevenue(result) // Setting total revenue once after the loop
  }

  useEffect(() => {
    total_net_profit()
    total_revenue()
  }, [])

  const [date, setDate] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 7)), // starting a week before the todays date
    to: new Date()
  })
  return (
    <div className="flex min-h-screen w-full flex-col">
      
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold md:text-2xl">Analytics</h1>
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
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card x-chunk="dashboard-01-chunk-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRevenue}</div>
              <p className="text-xs text-muted-foreground">+20.1% from last month</p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net profit</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalNetProfit}</div>
              <p className="text-xs text-muted-foreground">+180.1% from last month</p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{soldProducts.length}</div>
              <p className="text-xs text-muted-foreground">+19% from last month</p>
            </CardContent>
          </Card>
          <Card x-chunk="dashboard-01-chunk-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length+ ' '}Products</div>
              <p className="text-xs text-muted-foreground">+201 since last hour</p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4"></div>
      <LineChart date={date}/>
      </main>
    </div>
  )
}

export default Reports
