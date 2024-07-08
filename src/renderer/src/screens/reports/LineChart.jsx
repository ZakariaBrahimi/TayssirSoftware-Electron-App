/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { useContext, useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@shadcn-components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@shadcn-components/ui/chart'
import SalesContext from '../../context/SalesContext'

const chartConfig = {
  views: {
    label: 'Page Views'
  },
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--chart-1))'
  },
  netProfit: {
    label: 'Net Profit',
    color: 'hsl(var(--chart-2))'
  }
}

export default function Reports({ date }) {
  const { soldProducts } = useContext(SalesContext)
  const [activeChart, setActiveChart] = useState('revenue')
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    if (date?.from && date?.to) {
      const start = format(new Date(date.from), 'yyyy-MM-dd')
      const end = format(new Date(date.to), 'yyyy-MM-dd')

      const filteredData = soldProducts.filter((soldProduct) => {
        const currentDate = format(new Date(soldProduct.saleDate), 'yyyy-MM-dd')
        return currentDate >= start && currentDate <= end
      })

      const newChartData = filteredData.map((soldProduct) => {
        const price = soldProduct.product.price
        const cost = soldProduct.product.cost
        const discount = soldProduct.discount
        const quantity = soldProduct.quantity
        const netProfit = (price - cost - discount) * quantity
        const revenue = (price - discount) * quantity
        return {
          date: format(new Date(soldProduct.saleDate), 'yyyy-MM-dd'),
          revenue: revenue,
          netProfit: netProfit
        }
      })
      setChartData(newChartData)
    }
  }, [date, soldProducts])

  const total = useMemo(
    () => ({
      revenue: chartData.reduce((acc, curr) => acc + curr.revenue, 0),
      netProfit: chartData.reduce((acc, curr) => acc + curr.netProfit, 0)
    }),
    [chartData]
  )

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>Line Chart - Interactive</CardTitle>
          <CardDescription>Showing total visitors for the last 3 months</CardDescription>
        </div>
        <div className="flex">
          {['revenue', 'netProfit'].map((key) => {
            const chart = key
            return (
              <button
                key={chart}
                data-active={activeChart === chart}
                className="flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
                onClick={() => setActiveChart(chart)}
              >
                <span className="text-xs text-muted-foreground">{chartConfig[chart].label}</span>
                <span className="text-lg font-bold leading-none sm:text-3xl">
                  {total[chart].toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  }}
                />
              }
            />
            <Line
              dataKey={activeChart}
              type="monotone"
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
