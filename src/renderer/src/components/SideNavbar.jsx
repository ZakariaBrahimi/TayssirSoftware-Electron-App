/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */

import { Link, NavLink } from 'react-router-dom'

/* eslint-disable prettier/prettier */
import {
  Activity,
  ArrowUpRight,
  CircleUser,
  CreditCard,
  DollarSign,
  Menu,
  Package2,
  Search,
  Users
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@shadcn-components/ui/avatar'
import { Badge } from '@shadcn-components/ui/badge'
import { Button } from '@shadcn-components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@shadcn-components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shadcn-components/ui/dropdown-menu'
import { Input } from '@shadcn-components/ui/input'
import { Sheet, SheetContent, SheetTrigger } from '@shadcn-components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@shadcn-components/ui/table'
import { useContext, useEffect, useState } from 'react'

const SideNavbar = () => {
  return (
    <aside className="hidden bottom-0 fixed z-50 top-16 border-r bg-muted/40 lg:flex lg:flex-col pt-6 lg:w-[16%] ">
      {/* <div className="flex flex-1  flex-col gap-2 mt-8"> */}
          <nav className="grid gap-2 items-start px-2 text-sm font-medium lg:px-4">
            <NavLink
              className={({ isActive, isPending }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F4F4F5] text-[#71717A] text-muted-foreground transition-all hover:text-primary ${isActive ? 'bg-[#F4F4F5]' : 'hover:bg-[#F4F4F5]'}`
              }
              to="/"
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
                className="lucide lucide-home h-4 w-4"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              Dashboard
            </NavLink>
            
            <NavLink
              className={({ isActive, isPending }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F4F4F5] text-[#71717A] text-muted-foreground transition-all hover:text-primary ${isActive ? 'bg-[#F4F4F5]' : 'hover:bg-[#F4F4F5]'}`
              }
              to="sales"
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
                className="lucide lucide-shopping-cart h-4 w-4"
              >
                <circle cx="8" cy="21" r="1"></circle>
                <circle cx="19" cy="21" r="1"></circle>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
              </svg>
              Sales
              {/* <div className="border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80 ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                6
              </div> */}
            </NavLink>
            <NavLink
              className={({ isActive, isPending }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F4F4F5] text-[#71717A] text-muted-foreground transition-all hover:text-primary ${isActive ? 'bg-[#F4F4F5]' : 'hover:bg-[#F4F4F5]'}`
              }
              to="inventory"
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
                className="lucide lucide-package h-4 w-4"
              >
                <path d="m7.5 4.27 9 5.15"></path>
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                <path d="m3.3 7 8.7 5 8.7-5"></path>
                <path d="M12 22V12"></path>
              </svg>
              Inventory{' '}
            </NavLink>
            <NavLink
              className={({ isActive, isPending }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-[#71717A] text-muted-foreground transition-all hover:text-primary  ${isActive ? 'bg-[#F4F4F5]' : 'hover:bg-[#F4F4F5]'}`
              }
              to="/analytics"
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
                className="lucide lucide-line-chart h-4 w-4"
              >
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
              Analytics
            </NavLink>
            <NavLink
              className={({ isActive, isPending }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F4F4F5] text-[#71717A] text-muted-foreground transition-all hover:text-primary ${isActive ? 'bg-[#F4F4F5]' : 'hover:bg-[#F4F4F5]'}`
              }
              to="login"
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
                className="lucide lucide-shopping-cart h-4 w-4"
              >
                <circle cx="8" cy="21" r="1"></circle>
                <circle cx="19" cy="21" r="1"></circle>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
              </svg>
              Login
              {/* <div className="border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80 ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                6
              </div> */}
            </NavLink>
          </nav>
        <div className="mt-auto p-4">
          <div className="rounded-xl border bg-card text-card-foreground shadow">
            <div className="flex flex-col space-y-1.5 p-2 pt-0 md:p-4">
              <h3 className="font-semibold leading-none tracking-tight">Upgrade to Pro</h3>
              <p className="text-sm text-muted-foreground">
                Unlock all features and get unlimited access to our support team.
              </p>
            </div>
            <div className="p-2 pt-0 md:p-4 md:pt-0">
              <button className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs w-full">
                Upgrade
              </button>
            </div>
          </div>
        </div>
      {/* </div> */}
    </aside>
  )
}

export default SideNavbar